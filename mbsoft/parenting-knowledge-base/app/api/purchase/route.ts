import { NextRequest, NextResponse } from "next/server";
import { db, getPackageById } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { packageId } = await req.json();
  const pkg = getPackageById(packageId);
  if (!pkg) return NextResponse.json({ error: "套餐不存在" }, { status: 400 });

  // 免费体验直接激活，无需支付
  if (pkg.price === 0) {
    db.createPurchase({
      id: "pur-" + Math.random().toString(36).slice(2, 9),
      userId: user.id,
      packageId: pkg.id,
      amount: 0,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ message: "免费体验已激活！可阅读免费教程并开始打卡", free: true });
  }

  // 付费套餐：演示模式下模拟支付成功（实际接入微信/支付宝时替换此处）
  db.createPurchase({
    id: "pur-" + Math.random().toString(36).slice(2, 9),
    userId: user.id,
    packageId: pkg.id,
    amount: pkg.price,
    createdAt: new Date().toISOString(),
  });

  // 购买赠送积分
  const bonus = Math.round(pkg.price * 10);
  db.updateUser(user.id, { points: user.points + bonus });

  return NextResponse.json({
    message: `购买成功！${pkg.name}已激活，赠送 ${bonus} 积分`,
    purchase: { packageId: pkg.id, amount: pkg.price },
  });
}
