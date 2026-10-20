import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { db } from "@/lib/store";
import { LicenseCard, LicenseCardTier } from "@/lib/types";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 生成可读授权卡密钥：KB1M-XXXXXXXX / KB1Y-XXXXXXXX
// 字符集排除易混淆字符（0/O/1/I/L）
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function randBlock(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
function genCardCode(tier: LicenseCardTier): string {
  const prefix = tier === "year" ? "KB1Y-" : "KB1M-";
  const taken = sqliteTaken();
  let code = "";
  let guard = 0;
  do {
    code = prefix + randBlock(8);
  } while (taken.has(code) && guard++ < 50);
  return code;
}
// 取已占用密钥集合（与 store 隔离的轻量查询）
function sqliteTaken(): Set<string> {
  const rows = db.getLicenseCards();
  return new Set(rows.map((r) => r.code));
}

// GET：列表 + 统计
export async function GET() {
  const g = adminGuard();
  if (g.kind === "err") return g.res;
  const raw = db.getLicenseCards();
  const cards = raw.map((c) => {
    const u = c.usedBy ? db.getUserById(c.usedBy) : undefined;
    return { ...c, usedByNickname: u?.nickname, usedByPhone: u ? u.phone : undefined };
  });
  const stats = db.countCardsByStatus();
  return NextResponse.json({
    cards,
    stats: { ...stats, total: cards.length },
  });
}

// POST：批量生成授权卡
export async function POST(req: NextRequest) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;
  const admin = g.user;

  const body = await req.json().catch(() => null);
  const tier: LicenseCardTier = body?.tier === "year" ? "year" : "month";
  const count = Math.min(200, Math.max(1, parseInt(String(body?.count || "1"), 10) || 1));
  const batch = String(body?.batch || "").trim().slice(0, 40) || undefined;

  const created: LicenseCard[] = [];
  const taken = sqliteTaken();
  for (let i = 0; i < count; i++) {
    let code = "";
    let guard = 0;
    do {
      code = genCardCode(tier);
    } while (taken.has(code) && guard++ < 50);
    taken.add(code);
    const card: LicenseCard = {
      id: "card-" + Math.random().toString(36).slice(2, 10),
      code,
      tier,
      status: "unused",
      createdBy: admin.id,
      batch,
      createdAt: new Date().toISOString(),
    };
    db.createLicenseCard(card);
    created.push(card);
  }

  return NextResponse.json({
    ok: true,
    created,
    stats: db.countCardsByStatus(),
    message: `已生成 ${created.length} 张${tier === "year" ? "年度" : "月度"}授权卡`,
  });
}
