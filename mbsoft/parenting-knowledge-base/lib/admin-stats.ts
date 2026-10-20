import { db } from "./store";
import { AGE_LABELS, computeStreak } from "./recommend";
import { ChildProfile, UserRole, MembershipType } from "./types";
import { getAccessTier } from "./access";

// ---------- 日期工具（统一本地时区 YYYY-MM-DD） ----------
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const cur = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

export type SeriesPoint = { label: string; value: number };

export type AdminStats = {
  userTotal: number;
  userToday: number;
  user7d: number;
  userPrev7d: number;
  adminCount: number;
  memberWithProfile: number;
  checkInTotal: number;
  checkInToday: number;
  active7d: number;
  postTotal: number;
  postToday: number;
  replyTotal: number;
  topicTotal: number;
  premiumTotal: number;
  viewTotal: number;
  orderTotal: number;
  revenue: number;
  paidUsers: number;
  conversion: number; // 付费转化率 %
  avgPoints: number;
  // 邀请
  inviteTotal: number;
  inviteToday: number;
  invitedUsers: number;
  inviteRate: number; // 被邀请注册占比 %
  inviteRewardTotal: number;
  inviteTrend: SeriesPoint[];
  inviteLeaderboard: { nickname: string; count: number; points: number }[];
  userTrend: SeriesPoint[];
  checkInTrend: SeriesPoint[];
  ageDist: SeriesPoint[];
  painDist: SeriesPoint[];
  feedingDist: SeriesPoint[];
  topTopics: { slug: string; title: string; views: number; isPremium: boolean }[];
  recentUsers: { id: string; nickname: string; email: string; createdAt: string; role: string }[];
  recentPosts: { id: string; nickname: string; content: string; createdAt: string; likes: number }[];
};

export function getAdminStats(days = 14): AdminStats {
  const users = db.getAllUsers();
  const checkIns = db.getAllCheckIns();
  const posts = db.getAllPosts();
  const topics = db.getAllTopics();
  const purchases = db.getAllPurchases();
  const invites = db.getAllInvites();

  const dayList = lastNDays(days);
  const todayStr = dayList[dayList.length - 1];
  const set7 = new Set(lastNDays(7));
  const prev7 = lastNDays(14).slice(0, 7);
  const setPrev7 = new Set(prev7);

  const createdDay = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : dayKey(d);
  };

  const userToday = users.filter((u) => createdDay(u.createdAt) === todayStr).length;
  const user7d = users.filter((u) => set7.has(createdDay(u.createdAt))).length;
  const userPrev7d = users.filter((u) => setPrev7.has(createdDay(u.createdAt))).length;

  const active7dUsers = new Set(checkIns.filter((c) => set7.has(c.date)).map((c) => c.userId));

  const revenue = purchases.reduce((s, p) => s + (p.amount || 0), 0);
  const paidUsers = new Set(purchases.map((p) => p.userId)).size;

  // 用户画像分布
  const ageCount: Record<string, number> = {};
  const painCount: Record<string, number> = {};
  const feedCount: Record<string, number> = {};
  let memberWithProfile = 0;
  for (const u of users) {
    if (!u.childProfile) continue;
    memberWithProfile++;
    const p = u.childProfile;
    ageCount[p.ageBand] = (ageCount[p.ageBand] || 0) + 1;
    (p.pains || []).forEach((x) => (painCount[x] = (painCount[x] || 0) + 1));
    if (p.feeding) feedCount[p.feeding] = (feedCount[p.feeding] || 0) + 1;
  }

  const toSeries = (rec: Record<string, number>): SeriesPoint[] =>
    Object.entries(rec)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

  const ageDist = Object.keys(AGE_LABELS)
    .map((band) => ({ label: AGE_LABELS[band] ?? band, value: ageCount[band] || 0 }))
    .filter((x) => x.value > 0);

  return {
    userTotal: users.length,
    userToday,
    user7d,
    userPrev7d,
    adminCount: users.filter((u) => u.role === "admin").length,
    memberWithProfile,
    checkInTotal: checkIns.length,
    checkInToday: checkIns.filter((c) => c.date === todayStr).length,
    active7d: active7dUsers.size,
    postTotal: posts.filter((p) => !p.replyTo).length,
    postToday: posts.filter((p) => createdDay(p.createdAt) === todayStr && !p.replyTo).length,
    replyTotal: posts.filter((p) => !!p.replyTo).length,
    topicTotal: topics.length,
    premiumTotal: topics.filter((t) => t.isPremium).length,
    viewTotal: topics.reduce((s, t) => s + t.views, 0),
    orderTotal: purchases.length,
    revenue: Math.round(revenue * 100) / 100,
    paidUsers,
    conversion: users.length ? Math.round((paidUsers / users.length) * 1000) / 10 : 0,
    avgPoints: users.length ? Math.round(users.reduce((s, u) => s + u.points, 0) / users.length) : 0,

    inviteTotal: invites.length,
    inviteToday: invites.filter((i) => createdDay(i.createdAt) === todayStr).length,
    invitedUsers: users.filter((u) => !!u.invitedBy).length,
    inviteRate: users.length
      ? Math.round((users.filter((u) => !!u.invitedBy).length / users.length) * 1000) / 10
      : 0,
    inviteRewardTotal: invites.reduce((s, i) => s + (i.inviterPoints || 0) + (i.inviteePoints || 0), 0),
    inviteTrend: dayList.map((d) => ({
      label: d.slice(5),
      value: invites.filter((i) => createdDay(i.createdAt) === d).length,
    })),
    inviteLeaderboard: db.getInviteLeaderboard(5),

    userTrend: dayList.map((d) => ({
      label: d.slice(5),
      value: users.filter((u) => createdDay(u.createdAt) === d).length,
    })),
    checkInTrend: dayList.map((d) => ({
      label: d.slice(5),
      value: checkIns.filter((c) => c.date === d).length,
    })),

    ageDist,
    painDist: toSeries(painCount).slice(0, 6),
    feedingDist: toSeries(feedCount),

    topTopics: [...topics]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((t) => ({ slug: t.slug, title: t.title, views: t.views, isPremium: t.isPremium })),

    recentUsers: [...users]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 6)
      .map((u) => ({ id: u.id, nickname: u.nickname, email: u.email, createdAt: u.createdAt, role: u.role })),

    recentPosts: [...posts]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 6)
      .map((p) => ({ id: p.id, nickname: p.nickname, content: p.content, createdAt: p.createdAt, likes: p.likes })),
  };
}

// ---------- 会员管理列表（含行为统计） ----------
export type MemberRow = {
  id: string;
  nickname: string;
  phone: string;
  email: string;
  role: UserRole;
  points: number;
  createdAt: string;
  profile: ChildProfile | null;
  membershipType: MembershipType;
  membershipUntil?: string;
  checkInCount: number;
  streak: number;
  lastCheckIn: string;
  postCount: number;
  orderCount: number;
  amount: number;
  inviteCount: number; // 本人邀请成功的人数
  invitedByNickname: string; // 本人是被谁邀请的（空 = 自然注册）
  inviteCode: string;
};

export function getMemberRows(): MemberRow[] {
  const users = db.getAllUsers();
  const checkIns = db.getAllCheckIns();
  const posts = db.getAllPosts();
  const purchases = db.getAllPurchases();

  const checkByUser = new Map<string, typeof checkIns>();
  for (const c of checkIns) {
    const list = checkByUser.get(c.userId) ?? [];
    list.push(c);
    checkByUser.set(c.userId, list);
  }
  const postCount = new Map<string, number>();
  for (const p of posts) postCount.set(p.userId, (postCount.get(p.userId) ?? 0) + 1);
  const orderAgg = new Map<string, { count: number; amount: number }>();
  for (const p of purchases) {
    const cur = orderAgg.get(p.userId) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += p.amount;
    orderAgg.set(p.userId, cur);
  }

  // 邀请：按邀请人聚合邀请数 + 昵称索引（便于显示「由谁邀请」）
  const inviteCount = new Map<string, number>();
  for (const v of db.getAllInvites()) {
    inviteCount.set(v.inviterId, (inviteCount.get(v.inviterId) ?? 0) + 1);
  }
  const nickById = new Map(users.map((u) => [u.id, u.nickname]));

  return users.map((u) => {
    const mine = checkByUser.get(u.id) ?? [];
    const dates = mine.map((c) => c.date).sort();
    const agg = orderAgg.get(u.id) ?? { count: 0, amount: 0 };
    return {
      id: u.id,
      nickname: u.nickname,
      phone: u.phone,
      email: u.email || "",
      role: u.role,
      points: u.points,
      createdAt: u.createdAt,
      profile: u.childProfile ?? null,
      membershipType: u.membershipType,
      membershipUntil: u.membershipUntil,
      checkInCount: mine.length,
      streak: computeStreak(mine),
      lastCheckIn: dates[dates.length - 1] ?? "",
      postCount: postCount.get(u.id) ?? 0,
      orderCount: agg.count,
      amount: Math.round(agg.amount * 100) / 100,
      inviteCount: inviteCount.get(u.id) ?? 0,
      invitedByNickname: u.invitedBy ? nickById.get(u.invitedBy) ?? "" : "",
      inviteCode: u.inviteCode,
    };
  });
}
