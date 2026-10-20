import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const liked = db.likePost(params.id, user.id);
  if (!liked) {
    return NextResponse.json({ error: "已经点过赞了" }, { status: 400 });
  }
  return NextResponse.json({ message: "点赞成功" });
}
