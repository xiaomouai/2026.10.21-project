import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { readSiteSettings } from "@/lib/admin";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const today = todayStr();
  const existing = db
    .getCheckInsByUser(user.id)
    .find((c) => c.date === today);

  if (existing) {
    return NextResponse.json({ error: "今日已打卡", alreadyChecked: true }, { status: 400 });
  }

  // 连续打卡奖励：连续第N天额外给 N 积分（封顶+5）
  const yesterday = new Date(Date.now() - 86400000);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const hasYesterday = db.getCheckInsByUser(user.id).some((c) => c.date === yStr);
  const streak = hasYesterday
    ? db.getCheckInsByUser(user.id).filter((c) => c.date >= yStr).length + 1
    : 1;
  const base = readSiteSettings().checkInPoints; // 基础积分由后台配置
  const bonus = Math.min(streak, 5);
  const pointsEarned = base + bonus;

  const checkIn = {
    id: "c-" + Math.random().toString(36).slice(2, 9),
    userId: user.id,
    date: today,
    pointsEarned,
  };
  db.createCheckIn(checkIn);
  const updated = db.updateUser(user.id, { points: user.points + pointsEarned })!;

  return NextResponse.json({
    checkIn,
    pointsEarned,
    totalPoints: updated.points,
    streak,
    message: `打卡成功！获得 ${pointsEarned} 积分（含连续第${streak}天奖励）`,
  });
}

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const checkIns = db.getCheckInsByUser(user.id);
  const today = todayStr();
  const checkedToday = checkIns.some((c) => c.date === today);
  return NextResponse.json({ checkIns, checkedToday, count: checkIns.length });
}
