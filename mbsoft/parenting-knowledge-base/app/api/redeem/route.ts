import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { membershipUntil, membershipStatus } from "@/lib/access";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 兑换授权卡 → 激活会员（月卡 +30 天 / 年卡 +365 天）
export async function POST(req: NextRequest) {
  try {
    const user = getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { code } = await req.json();
    const norm = String(code || "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{6,24}$/.test(norm)) {
      return NextResponse.json({ error: "授权卡密钥格式不正确" }, { status: 400 });
    }

    const card = db.getLicenseCardByCode(norm);
    if (!card) return NextResponse.json({ error: "授权卡不存在" }, { status: 404 });
    if (card.status === "used") {
      return NextResponse.json({ error: "该授权卡已被使用", used: true }, { status: 400 });
    }

    // 已激活同类会员则在现有到期时间上顺延，否则从当前时刻起算
    const prevUntil = user.membershipUntil ? new Date(user.membershipUntil).getTime() : 0;
    const base = prevUntil > Date.now() ? prevUntil : Date.now();
    const days = card.tier === "year" ? 365 : 30;
    const until = new Date(base + days * 86400000).toISOString();

    db.markCardUsed(norm, user.id);
    db.updateUser(user.id, { membershipType: card.tier, membershipUntil: until });

    const updated = db.getUserById(user.id)!;
    return NextResponse.json({
      ok: true,
      tier: card.tier,
      until,
      status: membershipStatus(updated),
      message: `已激活${card.tier === "year" ? "年度" : "月度"}会员，有效期至 ${until.slice(0, 10)}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "兑换失败" }, { status: 500 });
  }
}
