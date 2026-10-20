import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { AGE_BANDS, PAIN_OPTIONS, FEEDING_OPTIONS, GOAL_OPTIONS } from "@/lib/recommend";
import { ChildProfile } from "@/lib/types";
import { membershipStatus } from "@/lib/access";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 获取当前用户宝宝档案 + 会员状态 + 基础信息
export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({
    nickname: user.nickname,
    phone: user.phone,
    points: user.points,
    childProfile: user.childProfile || null,
    membership: membershipStatus(user),
  });
}

// 保存调研结果
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  try {
    const body = await req.json();
    const { ageBand, pains, feeding, goal } = body;

    if (!ageBand || !(AGE_BANDS as readonly string[]).includes(ageBand)) {
      return NextResponse.json({ error: "请选择宝宝月龄段" }, { status: 400 });
    }
    if (!Array.isArray(pains) || pains.length === 0) {
      return NextResponse.json({ error: "请至少选择一个当前困扰" }, { status: 400 });
    }
    const validPains = pains.filter((p: string) => (PAIN_OPTIONS as readonly string[]).includes(p));
    if (validPains.length !== pains.length) {
      return NextResponse.json({ error: "困扰选项无效" }, { status: 400 });
    }

    const childProfile: ChildProfile = {
      ageBand,
      pains: validPains.slice(0, 3),
      feeding: (FEEDING_OPTIONS as readonly string[]).includes(feeding) ? feeding : undefined,
      goal: (GOAL_OPTIONS as readonly string[]).includes(goal) ? goal : undefined,
      updatedAt: new Date().toISOString(),
    };

    db.updateUser(user.id, { childProfile });
    return NextResponse.json({ ok: true, childProfile });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "保存失败" }, { status: 500 });
  }
}
