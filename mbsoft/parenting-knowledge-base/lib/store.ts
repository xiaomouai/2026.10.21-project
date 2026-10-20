import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { User, Topic, CheckIn, Post, Purchase, Invite, UserRole, MembershipType, LicenseCard, LicenseCardTier, Conversation, ChatMessage } from "./types";
import { SEED_TOPICS, SEED_POSTS } from "./seed";
import { genInviteCode } from "./invite";

// ---------- 数据库初始化 ----------
// 数据文件位于 <项目根>/data/app.db（可用环境变量 KB_DATA_DIR 覆盖，Docker 构建期
// 指向临时目录），重启不丢数据。
function dataDir(): string {
  return process.env.KB_DATA_DIR || path.join(process.cwd(), "data");
}

const globalAny = global as any;

/** 统一的数据库入口：首次调用时才真正打开连接并完成建表/迁移/种子 */
function getConn(): Database.Database {
  return (globalAny.__kb_sqlite__ as Database.Database | undefined) ?? initDb();
}

/**
 * 惰性初始化：建目录 → 开连接 → 调参 → 建表 → 迁移 → 种子（幂等）。
 *
 * 必须惰性执行，绝不能在模块顶层跑：`next build` 的 "Collecting page data"
 * 会 fork 多个 worker 并行 import 路由与页面模块。若在 import 阶段就打开连接
 * 并执行 `pragma journal_mode = WAL`（切换 WAL 需要排它锁），多进程争锁会直接
 * 抛 SQLITE_BUSY 把构建打断。惰性化后 import 只注册模块，不碰数据库文件。
 */
function initDb(): Database.Database {
  // 全局单例：dev HMR / 多路由实例共享同一连接
  const cached = globalAny.__kb_sqlite__ as Database.Database | undefined;
  if (cached) return cached;

  fs.mkdirSync(dataDir(), { recursive: true });
  const conn = new Database(path.join(dataDir(), "app.db"));
  // 顺序有意义：先设 busy_timeout（遇锁等待而非立刻报错），再切 WAL
  conn.pragma("busy_timeout = 5000");
  try {
    conn.pragma("journal_mode = WAL");
  } catch {
    // 极端并发下仍可能抢不到锁：保持默认日志模式，功能不受影响
  }

  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      phone TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      child_profile TEXT
    );
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      is_premium INTEGER NOT NULL DEFAULT 0,
      author_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      points_earned INTEGER NOT NULL,
      UNIQUE(user_id, date)
    );
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      topic_id TEXT,
      user_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      liked_by TEXT NOT NULL DEFAULT '[]',
      reply_to TEXT,
      reply_to_nickname TEXT
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      inviter_id TEXT NOT NULL,
      invitee_id TEXT NOT NULL,
      code TEXT NOT NULL,
      inviter_points INTEGER NOT NULL DEFAULT 0,
      invitee_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(invitee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_invites_inviter ON invites(inviter_id);

    -- Agent 会话与消息（2026-09 新增 AI 育儿助手）
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

    -- 授权卡（后台生成，用户兑换激活会员）
    CREATE TABLE IF NOT EXISTS license_cards (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      tier TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unused',
      used_by TEXT,
      used_at TEXT,
      created_by TEXT,
      batch TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cards_status ON license_cards(status);
  `);

  // 迁移：老库补 reply 列（2026-09 新增回复功能）
  {
    const cols: string[] = conn.prepare("PRAGMA table_info(posts)").all().map((c: any) => c.name);
    if (!cols.includes("reply_to")) conn.exec("ALTER TABLE posts ADD COLUMN reply_to TEXT");
    if (!cols.includes("reply_to_nickname")) conn.exec("ALTER TABLE posts ADD COLUMN reply_to_nickname TEXT");
  }

  // 迁移：老库补 role 列（2026-09 新增后台管理）
  {
    const cols: string[] = conn.prepare("PRAGMA table_info(users)").all().map((c: any) => c.name);
    if (!cols.includes("role")) conn.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  // 迁移：老库补邀请相关列（2026-09 新增邀请功能）
  {
    const cols: string[] = conn.prepare("PRAGMA table_info(users)").all().map((c: any) => c.name);
    if (!cols.includes("invite_code")) conn.exec("ALTER TABLE users ADD COLUMN invite_code TEXT");
    if (!cols.includes("invited_by")) conn.exec("ALTER TABLE users ADD COLUMN invited_by TEXT");
    // SQLite 的 ALTER TABLE 无法加 UNIQUE 约束，用唯一索引替代（NULL 允许多个）
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code)");
  }

  // 迁移：AI 助手免费额度计数（2026-09 新增聊天限流）
  {
    const cols: string[] = conn.prepare("PRAGMA table_info(users)").all().map((c: any) => c.name);
    if (!cols.includes("ai_used")) conn.exec("ALTER TABLE users ADD COLUMN ai_used INTEGER NOT NULL DEFAULT 0");
  }

  // 迁移：手机号登录 + 会员档位（2026-09 新增）
  {
    const cols: string[] = conn.prepare("PRAGMA table_info(users)").all().map((c: any) => c.name);
    if (!cols.includes("phone")) conn.exec("ALTER TABLE users ADD COLUMN phone TEXT");
    if (!cols.includes("membership_type")) conn.exec("ALTER TABLE users ADD COLUMN membership_type TEXT NOT NULL DEFAULT 'none'");
    if (!cols.includes("membership_until")) conn.exec("ALTER TABLE users ADD COLUMN membership_until TEXT");
    // phone 是唯一登录标识。老库可能为空或存在重复（早期回填算法退化），
    // 先回填演示号，再按注册顺序为「空号 / 重号」重新分配唯一号，最后建唯一索引。
    {
      const backfill: Record<string, string> = {
        "demo@test.com": "13800001234",
        "admin@test.com": "13800000000",
        "author@test.com": "13800005678",
      };
      const upd = conn.prepare(
        "UPDATE users SET phone = ? WHERE email = ? AND (phone IS NULL OR phone = '')"
      );
      for (const [email, phone] of Object.entries(backfill)) upd.run(phone, email);

      const taken = new Set<string>();
      const rows = conn
        .prepare("SELECT id, phone FROM users ORDER BY created_at, id")
        .all() as { id: string; phone: string | null }[];
      const set = conn.prepare("UPDATE users SET phone = ? WHERE id = ?");
      let seq = 10000000; // 生成 139 + 8 位序号，保证 11 位且不与已占用号冲突
      const nextPhone = () => {
        let p = "";
        do {
          p = "139" + String(seq++);
        } while (taken.has(p));
        taken.add(p);
        return p;
      };
      for (const r of rows) {
        const p = (r.phone || "").trim();
        if (p && !taken.has(p)) {
          taken.add(p);
          continue;
        }
        set.run(nextPhone(), r.id); // 空号或重号 → 重新分配
      }
    }
    conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)");
  }

  // 迁移：email 改为可选（老库建表时为 NOT NULL UNIQUE，而注册已不再收集邮箱）。
  // SQLite 不支持 ALTER COLUMN，需重建表；本库无外键引用 users，可安全重建。
  {
    const ddl = conn
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
      .get() as { sql: string } | undefined;
    if (ddl && /email\s+TEXT\s+NOT\s+NULL/i.test(ddl.sql)) {
      const cols = conn.prepare("PRAGMA table_info(users)").all().map((c: any) => c.name);
      const colList = cols.map((c: string) => `"${c}"`).join(", ");
      conn.pragma("foreign_keys = OFF");
      conn.transaction(() => {
        conn.exec(`
          CREATE TABLE users__new (
            id TEXT PRIMARY KEY,
            email TEXT,
            phone TEXT NOT NULL UNIQUE,
            nickname TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            points INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            child_profile TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            invite_code TEXT,
            invited_by TEXT,
            membership_type TEXT NOT NULL DEFAULT 'none',
            membership_until TEXT
          );
        `);
        conn.exec(`INSERT INTO users__new (${colList}) SELECT ${colList} FROM users`);
        conn.exec("DROP TABLE users");
        conn.exec("ALTER TABLE users__new RENAME TO users");
      })();
      conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code)");
      conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)");
    }
  }

  // 迁移完成后再灌种子 / 确保管理员与邀请码存在（均为幂等操作）
  seed(conn);
  ensureAdmin(conn);
  ensureInviteCodes(conn);

  globalAny.__kb_sqlite__ = conn;
  return conn;
}

// 行 ↔ 类型映射
function rowToUser(r: any): User {
  return {
    id: r.id,
    phone: r.phone || "",
    email: r.email || undefined,
    nickname: r.nickname,
    passwordHash: r.password_hash,
    points: r.points,
    createdAt: r.created_at,
    role: (r.role || "user") as UserRole,
    inviteCode: r.invite_code || "",
    invitedBy: r.invited_by || undefined,
    childProfile: r.child_profile ? JSON.parse(r.child_profile) : undefined,
    membershipType: (r.membership_type || "none") as MembershipType,
    membershipUntil: r.membership_until || undefined,
    aiUsed: Number(r.ai_used || 0),
  };
}
const rowToTopic = (r: any): Topic => ({
  id: r.id, slug: r.slug, title: r.title, category: r.category,
  excerpt: r.excerpt, content: r.content, isPremium: !!r.is_premium,
  authorId: r.author_id, createdAt: r.created_at, views: r.views,
});
const rowToCheckIn = (r: any): CheckIn => ({
  id: r.id, userId: r.user_id, date: r.date, pointsEarned: r.points_earned,
});
const rowToPost = (r: any): Post => ({
  id: r.id, topicId: r.topic_id || undefined, userId: r.user_id,
  nickname: r.nickname, title: r.title || undefined, content: r.content,
  createdAt: r.created_at, likes: r.likes, likedBy: JSON.parse(r.liked_by),
  replyTo: r.reply_to || undefined,
  replyToNickname: r.reply_to_nickname || undefined,
});
const rowToPurchase = (r: any): Purchase => ({
  id: r.id, userId: r.user_id, packageId: r.package_id,
  amount: r.amount, createdAt: r.created_at,
});
const rowToInvite = (r: any): Invite => ({
  id: r.id, inviterId: r.inviter_id, inviteeId: r.invitee_id, code: r.code,
  inviterPoints: r.inviter_points, inviteePoints: r.invitee_points, createdAt: r.created_at,
});
const rowToConversation = (r: any): Conversation => ({
  id: r.id, userId: r.user_id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at,
});
const rowToMessage = (r: any): ChatMessage => ({
  id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, createdAt: r.created_at,
});

// ---------- 首次启动种子数据 ----------
// 仅在 initDb() 内调用一次。种子写入用 IMMEDIATE 事务串行化 + 事务内二次检查，
// 即使多个进程同时首次启动，也只会有一份数据被写入。
function seed(conn: Database.Database) {
  if (conn.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) return;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bcrypt = require("bcryptjs");
  const insertUser = conn.prepare(
    "INSERT OR IGNORE INTO users (id, email, phone, nickname, password_hash, points, created_at, role, child_profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)"
  );
  const insertTopic = conn.prepare(
    "INSERT OR IGNORE INTO topics (id, slug, title, category, excerpt, content, is_premium, author_id, created_at, views) VALUES (@id, @slug, @title, @category, @excerpt, @content, @isPremium, @authorId, @createdAt, @views)"
  );
  const insertPost = conn.prepare(
    "INSERT OR IGNORE INTO posts (id, topic_id, user_id, nickname, title, content, created_at, likes, liked_by) VALUES (@id, @topicId, @userId, @nickname, @title, @content, @createdAt, @likes, @likedBy)"
  );

  const runSeed = conn.transaction(() => {
    // 事务内二次检查：拿到写锁后若别的进程已完成 seed，直接返回
    if (conn.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) return;

    insertUser.run(
      "u-demo", "demo@test.com", "13800001234", "新手妈妈小雅",
      bcrypt.hashSync("123456", 10), 120, new Date().toISOString(), "user"
    );
    insertUser.run(
      "u-author", "author@test.com", "13800005678", "好宝宝育儿师·林",
      bcrypt.hashSync("123456", 10), 580,
      new Date(Date.now() - 86400000 * 30).toISOString(), "user"
    );
    for (const t of SEED_TOPICS) insertTopic.run({ ...t, isPremium: t.isPremium ? 1 : 0 });
    for (const p of SEED_POSTS) {
      insertPost.run({
        ...p, title: p.title ?? null, topicId: p.topicId ?? null,
        likedBy: JSON.stringify(p.likedBy),
      });
    }
  });
  runSeed.immediate();
}

// ---------- 管理员账号（设置初始密码后创建） ----------
function ensureAdmin(conn: Database.Database) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return;
  const exists = conn.prepare("SELECT id, role FROM users WHERE email = ?").get("admin@test.com") as
    | { id: string; role: string }
    | undefined;
  if (exists) {
    if (exists.role !== "admin") conn.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(exists.id);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bcrypt = require("bcryptjs");
  conn
    .prepare(
      "INSERT OR IGNORE INTO users (id, email, phone, nickname, password_hash, points, created_at, role, invite_code, child_profile) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?, NULL)"
    )
    .run("u-admin", "admin@test.com", "13800000000", "超级管理员", bcrypt.hashSync(adminPassword, 10), 0, new Date().toISOString(), genInviteCode());
}

// ---------- 邀请码：保证每个用户都有唯一邀请码 ----------
// 覆盖老库已有用户、种子用户与管理员（幂等，每次启动都会补齐缺失的）
function ensureInviteCodes(conn: Database.Database) {
  const rows = conn
    .prepare("SELECT id FROM users WHERE invite_code IS NULL OR invite_code = ''")
    .all() as { id: string }[];
  if (!rows.length) return;
  const upd = conn.prepare("UPDATE users SET invite_code = ? WHERE id = ?");
  const taken = conn.prepare("SELECT 1 FROM users WHERE invite_code = ?");
  conn.transaction(() => {
    for (const r of rows) {
      let code = genInviteCode();
      let guard = 0;
      while (taken.get(code) && guard++ < 50) code = genInviteCode();
      upd.run(code, r.id);
    }
  })();
}

// ---------- 访问方法（与原内存版 API 完全一致） ----------

/** 生成一个未被占用的邀请码 */
function uniqueInviteCode(): string {
  const taken = getConn().prepare("SELECT 1 FROM users WHERE invite_code = ?");
  let code = genInviteCode();
  let guard = 0;
  while (taken.get(code) && guard++ < 50) code = genInviteCode();
  return code;
}

export const db = {
  // 用户
  getUserByEmail: (email: string): User | undefined => {
    const r = getConn().prepare("SELECT * FROM users WHERE email = ?").get(email);
    return r ? rowToUser(r) : undefined;
  },
  getUserByPhone: (phone: string): User | undefined => {
    const r = getConn().prepare("SELECT * FROM users WHERE phone = ?").get(phone);
    return r ? rowToUser(r) : undefined;
  },
  getUserById: (id: string): User | undefined => {
    const r = getConn().prepare("SELECT * FROM users WHERE id = ?").get(id);
    return r ? rowToUser(r) : undefined;
  },
  createUser: (user: User) => {
    getConn()
      .prepare("INSERT INTO users (id, email, phone, nickname, password_hash, points, created_at, role, invite_code, invited_by, child_profile, membership_type, membership_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        user.id, user.email ?? null, user.phone, user.nickname, user.passwordHash, user.points, user.createdAt,
        user.role || "user", user.inviteCode || uniqueInviteCode(), user.invitedBy ?? null,
        user.childProfile ? JSON.stringify(user.childProfile) : null,
        user.membershipType || "none", user.membershipUntil ?? null
      );
  },
  updateUser: (id: string, patch: Partial<User>): User | undefined => {
    const user = db.getUserById(id);
    if (!user) return undefined;
    const merged = { ...user, ...patch };
    getConn()
      .prepare("UPDATE users SET nickname = ?, points = ?, role = ?, child_profile = ?, phone = ?, membership_type = ?, membership_until = ? WHERE id = ?")
      .run(
        merged.nickname, merged.points, merged.role,
        merged.childProfile ? JSON.stringify(merged.childProfile) : null,
        merged.phone || user.phone, merged.membershipType || "none", merged.membershipUntil ?? null,
        id
      );
    return merged;
  },
  updatePassword: (id: string, passwordHash: string) => {
    getConn().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  },
  // AI 助手计数：原子累加已用次数并返回最新值。
  // 由路由在「模型已产出首个 token」后调用 —— 模型报错/无输出不计费，
  // 避免网络抖动白白吞掉用户仅有的 1 次免费额度。
  bumpAiUsage: (id: string): number => {
    getConn().prepare("UPDATE users SET ai_used = COALESCE(ai_used, 0) + 1 WHERE id = ?").run(id);
    const r = getConn().prepare("SELECT COALESCE(ai_used, 0) AS n FROM users WHERE id = ?").get(id) as { n: number } | undefined;
    return r?.n ?? 0;
  },
  // 重置 AI 已用次数（开通年卡、运营补偿时使用）
  resetAiUsage: (id: string) => {
    getConn().prepare("UPDATE users SET ai_used = 0 WHERE id = ?").run(id);
  },
  // 原子加/减积分：避免「读-改-写」在并发下互相覆盖（如同时被多人邀请）
  addPoints: (id: string, delta: number): number => {
    getConn().prepare("UPDATE users SET points = points + ? WHERE id = ?").run(delta, id);
    const r = getConn().prepare("SELECT points FROM users WHERE id = ?").get(id) as { points: number } | undefined;
    return r?.points ?? 0;
  },
  deleteUser: (id: string) => {
    getConn().transaction(() => {
      getConn().prepare("DELETE FROM check_ins WHERE user_id = ?").run(id);
      getConn().prepare("DELETE FROM posts WHERE user_id = ?").run(id);
      getConn().prepare("DELETE FROM purchases WHERE user_id = ?").run(id);
      // 邀请记录：作为被邀请人的记录删除；作为邀请人的保留（已发奖励不回收）
      getConn().prepare("DELETE FROM invites WHERE invitee_id = ?").run(id);
      getConn().prepare("UPDATE invites SET inviter_id = '' WHERE inviter_id = ?").run(id);
      getConn().prepare("DELETE FROM users WHERE id = ?").run(id);
    })();
  },
  countAdmins: (): number =>
    (getConn().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as any).n,
  getAllUsers: (): User[] =>
    getConn().prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(rowToUser),

  // 主题
  getAllTopics: (): Topic[] =>
    getConn().prepare("SELECT * FROM topics ORDER BY created_at ASC").all().map(rowToTopic),
  getTopicBySlug: (slug: string): Topic | undefined => {
    const r = getConn().prepare("SELECT * FROM topics WHERE slug = ?").get(slug);
    return r ? rowToTopic(r) : undefined;
  },
  getTopicsByCategory: (cat: string): Topic[] =>
    getConn().prepare("SELECT * FROM topics WHERE category = ?").all(cat).map(rowToTopic),
  searchTopics: (q: string): Topic[] =>
    getConn()
      .prepare("SELECT * FROM topics WHERE title LIKE ? OR content LIKE ? OR category LIKE ? OR excerpt LIKE ?")
      .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
      .map(rowToTopic),
  incrementViews: (slug: string) => {
    getConn().prepare("UPDATE topics SET views = views + 1 WHERE slug = ?").run(slug);
  },
  // --- 知识库管理（后台） ---
  getTopicById: (id: string): Topic | undefined => {
    const r = getConn().prepare("SELECT * FROM topics WHERE id = ?").get(id);
    return r ? rowToTopic(r) : undefined;
  },
  createTopic: (t: Topic) => {
    getConn()
      .prepare("INSERT INTO topics (id, slug, title, category, excerpt, content, is_premium, author_id, created_at, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(t.id, t.slug, t.title, t.category, t.excerpt, t.content, t.isPremium ? 1 : 0, t.authorId, t.createdAt, t.views);
  },
  updateTopic: (id: string, patch: Partial<Topic>): Topic | undefined => {
    const cur = db.getTopicById(id);
    if (!cur) return undefined;
    const merged = { ...cur, ...patch };
    getConn()
      .prepare("UPDATE topics SET slug = ?, title = ?, category = ?, excerpt = ?, content = ?, is_premium = ?, author_id = ? WHERE id = ?")
      .run(merged.slug, merged.title, merged.category, merged.excerpt, merged.content, merged.isPremium ? 1 : 0, merged.authorId, id);
    return merged;
  },
  deleteTopic: (id: string) => {
    getConn().prepare("DELETE FROM topics WHERE id = ?").run(id);
  },
  deleteAllTopics: () => {
    getConn().prepare("DELETE FROM topics").run();
  },
  countTopics: (): number => (getConn().prepare("SELECT COUNT(*) AS n FROM topics").get() as any).n,

  // 打卡
  getCheckInsByUser: (userId: string): CheckIn[] =>
    getConn().prepare("SELECT * FROM check_ins WHERE user_id = ? ORDER BY date ASC").all(userId).map(rowToCheckIn),
  createCheckIn: (c: CheckIn) => {
    getConn()
      .prepare("INSERT OR IGNORE INTO check_ins (id, user_id, date, points_earned) VALUES (?, ?, ?, ?)")
      .run(c.id, c.userId, c.date, c.pointsEarned);
  },
  getAllCheckIns: (): CheckIn[] =>
    getConn().prepare("SELECT * FROM check_ins ORDER BY date ASC").all().map(rowToCheckIn),

  // 论坛帖子
  getAllPosts: (): Post[] =>
    getConn().prepare("SELECT * FROM posts ORDER BY created_at ASC").all().map(rowToPost),
  getPostById: (id: string): Post | undefined => {
    const r = getConn().prepare("SELECT * FROM posts WHERE id = ?").get(id);
    return r ? rowToPost(r) : undefined;
  },
  getPostsByTopic: (topicId: string): Post[] =>
    getConn().prepare("SELECT * FROM posts WHERE topic_id = ? ORDER BY created_at ASC").all(topicId).map(rowToPost),
  createPost: (p: Post) => {
    getConn()
      .prepare("INSERT INTO posts (id, topic_id, user_id, nickname, title, content, created_at, likes, liked_by, reply_to, reply_to_nickname) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(p.id, p.topicId ?? null, p.userId, p.nickname, p.title ?? null, p.content, p.createdAt, p.likes, JSON.stringify(p.likedBy), p.replyTo ?? null, p.replyToNickname ?? null);
  },
  likePost: (postId: string, userId: string): boolean => {
    const r = getConn().prepare("SELECT liked_by FROM posts WHERE id = ?").get(postId);
    if (!r) return false;
    const likedBy: string[] = JSON.parse(r.liked_by);
    if (likedBy.includes(userId)) return false;
    likedBy.push(userId);
    getConn()
      .prepare("UPDATE posts SET liked_by = ?, likes = likes + 1 WHERE id = ?")
      .run(JSON.stringify(likedBy), postId);
    return true;
  },

  // 购买
  getPurchasesByUser: (userId: string): Purchase[] =>
    getConn().prepare("SELECT * FROM purchases WHERE user_id = ?").all(userId).map(rowToPurchase),
  getAllPurchases: (): Purchase[] =>
    getConn().prepare("SELECT * FROM purchases ORDER BY created_at ASC").all().map(rowToPurchase),
  createPurchase: (p: Purchase) => {
    getConn()
      .prepare("INSERT INTO purchases (id, user_id, package_id, amount, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(p.id, p.userId, p.packageId, p.amount, p.createdAt);
  },
  // 邀请
  getUserByInviteCode: (code: string): User | undefined => {
    const r = getConn().prepare("SELECT * FROM users WHERE invite_code = ?").get(code);
    return r ? rowToUser(r) : undefined;
  },
  /** 取用户邀请码；极老的数据若为空则即时补一个（幂等） */
  ensureInviteCode: (userId: string): string => {
    const r = getConn().prepare("SELECT invite_code FROM users WHERE id = ?").get(userId) as
      | { invite_code: string | null }
      | undefined;
    if (!r) return "";
    if (r.invite_code) return r.invite_code;
    const code = uniqueInviteCode();
    getConn().prepare("UPDATE users SET invite_code = ? WHERE id = ?").run(code, userId);
    return code;
  },
  createInvite: (v: Invite) => {
    getConn()
      .prepare("INSERT OR IGNORE INTO invites (id, inviter_id, invitee_id, code, inviter_points, invitee_points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(v.id, v.inviterId, v.inviteeId, v.code, v.inviterPoints, v.inviteePoints, v.createdAt);
  },
  getInvitesByInviter: (inviterId: string): Invite[] =>
    getConn().prepare("SELECT * FROM invites WHERE inviter_id = ? ORDER BY created_at DESC").all(inviterId).map(rowToInvite),
  getInviteByInvitee: (inviteeId: string): Invite | undefined => {
    const r = getConn().prepare("SELECT * FROM invites WHERE invitee_id = ?").get(inviteeId);
    return r ? rowToInvite(r) : undefined;
  },
  getAllInvites: (): Invite[] =>
    getConn().prepare("SELECT * FROM invites ORDER BY created_at DESC").all().map(rowToInvite),
  countInvites: (): number => (getConn().prepare("SELECT COUNT(*) AS n FROM invites").get() as any).n,

  // 邀请明细（联表取被邀请人昵称，供邀请中心列表展示）
  getInviteDetailsByInviter: (
    inviterId: string
  ): { nickname: string; createdAt: string; points: number; hasProfile: boolean }[] =>
    getConn()
      .prepare(
        `SELECT u.nickname AS nickname, u.child_profile AS child_profile, i.created_at AS created_at, i.inviter_points AS points
         FROM invites i JOIN users u ON u.id = i.invitee_id
         WHERE i.inviter_id = ? ORDER BY i.created_at DESC`
      )
      .all(inviterId)
      .map((r: any) => ({
        nickname: r.nickname,
        createdAt: r.created_at,
        points: r.points,
        hasProfile: !!r.child_profile,
      })),

  // 邀请达人榜（后台统计用）
  getInviteLeaderboard: (limit = 5): { nickname: string; count: number; points: number }[] =>
    getConn()
      .prepare(
        `SELECT u.nickname AS nickname, COUNT(*) AS count, SUM(i.inviter_points) AS points
         FROM invites i JOIN users u ON u.id = i.inviter_id
         GROUP BY i.inviter_id ORDER BY count DESC, points DESC LIMIT ?`
      )
      .all(limit)
      .map((r: any) => ({ nickname: r.nickname, count: r.count, points: r.points })),

  // ---------- 授权卡（后台生成 / 用户兑换） ----------
  createLicenseCard: (card: LicenseCard) => {
    getConn()
      .prepare("INSERT OR IGNORE INTO license_cards (id, code, tier, status, used_by, used_at, created_by, batch, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        card.id, card.code, card.tier, card.status, card.usedBy ?? null, card.usedAt ?? null,
        card.createdBy ?? null, card.batch ?? null, card.createdAt
      );
  },
  getLicenseCardByCode: (code: string): LicenseCard | undefined => {
    const r = getConn().prepare("SELECT * FROM license_cards WHERE code = ?").get(code);
    if (!r) return undefined;
    return {
      id: r.id, code: r.code, tier: r.tier, status: r.status,
      usedBy: r.used_by || undefined, usedAt: r.used_at || undefined,
      createdBy: r.created_by || undefined, batch: r.batch || undefined, createdAt: r.created_at,
    };
  },
  getLicenseCards: (): LicenseCard[] =>
    getConn().prepare("SELECT * FROM license_cards ORDER BY created_at DESC").all().map((r: any) => ({
      id: r.id, code: r.code, tier: r.tier, status: r.status,
      usedBy: r.used_by || undefined, usedAt: r.used_at || undefined,
      createdBy: r.created_by || undefined, batch: r.batch || undefined, createdAt: r.created_at,
    })),
  markCardUsed: (code: string, userId: string) => {
    getConn()
      .prepare("UPDATE license_cards SET status = 'used', used_by = ?, used_at = ? WHERE code = ?")
      .run(userId, new Date().toISOString(), code);
  },
  countCardsByStatus: (): { unused: number; used: number } => {
    const rows = getConn().prepare("SELECT status, COUNT(*) AS n FROM license_cards GROUP BY status").all() as any[];
    const out = { unused: 0, used: 0 };
    for (const r of rows) if (r.status === "used") out.used = r.n; else out.unused = r.n;
    return out;
  },

  // ---------- Agent 会话与消息 ----------
  getConversation: (id: string, userId: string): Conversation | undefined => {
    const r = getConn().prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?").get(id, userId);
    return r ? rowToConversation(r) : undefined;
  },
  createConversation: (c: { id: string; userId: string; title: string }) => {
    const now = new Date().toISOString();
    getConn()
      .prepare("INSERT OR IGNORE INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(c.id, c.userId, c.title, now, now);
  },
  touchConversation: (id: string, title?: string) => {
    const now = new Date().toISOString();
    if (title) {
      getConn().prepare("UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?").run(now, title, id);
    } else {
      getConn().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, id);
    }
  },
  listConversations: (userId: string): Conversation[] =>
    getConn()
      .prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC")
      .all(userId)
      .map(rowToConversation),
  addMessage: (m: { id: string; conversationId: string; role: string; content: string }) => {
    getConn()
      .prepare("INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(m.id, m.conversationId, m.role, m.content, new Date().toISOString());
  },
  getMessages: (conversationId: string, userId: string): ChatMessage[] => {
    const conv = getConn().prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?").get(conversationId, userId);
    if (!conv) return [];
    return getConn()
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId)
      .map(rowToMessage);
  },

  // 内容审核（后台）
  deletePost: (id: string) => {
    // 连带删除它的回复（一层嵌套）
    getConn().transaction(() => {
      getConn().prepare("DELETE FROM posts WHERE reply_to = ?").run(id);
      getConn().prepare("DELETE FROM posts WHERE id = ?").run(id);
    })();
  },
  countPosts: (): number => (getConn().prepare("SELECT COUNT(*) AS n FROM posts").get() as any).n,

  // 设置（key-value，存 JSON 字符串）
  getSetting: <T = any>(key: string, fallback: T): T => {
    const r = getConn().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    if (!r) return fallback;
    try {
      return JSON.parse(r.value) as T;
    } catch {
      return fallback;
    }
  },
  setSetting: (key: string, value: unknown) => {
    getConn()
      .prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      )
      .run(key, JSON.stringify(value), new Date().toISOString());
  },
};

// ---------- 会员套餐（静态数据，见 lib/packages.ts） ----------
export { PACKAGES, getPackageById } from "./packages";
