import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";
import { readSiteSettings } from "@/lib/admin";
import { Post } from "@/lib/types";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topicId");
  const posts = topicId ? db.getPostsByTopic(topicId) : db.getAllPosts();
  // 按时间倒序
  return NextResponse.json({ posts: [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { content, title, topicId, replyTo } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
  }

  // 回复目标校验：父帖必须存在
  let replyToNickname: string | undefined;
  if (replyTo) {
    const parent = db.getPostById(replyTo);
    if (!parent) {
      return NextResponse.json({ error: "回复的帖子不存在" }, { status: 400 });
    }
    replyToNickname = parent.nickname;
  }

  const post: Post = {
    id: "p-" + Math.random().toString(36).slice(2, 9),
    userId: user.id,
    nickname: user.nickname,
    title: title || undefined,
    content: content.trim(),
    topicId: topicId || undefined,
    createdAt: new Date().toISOString(),
    likes: 0,
    likedBy: [],
    replyTo: replyTo || undefined,
    replyToNickname,
  };
  db.createPost(post);

  // 发帖奖励积分（数值由后台配置）
  const reward = readSiteSettings().postPoints;
  db.updateUser(user.id, { points: user.points + reward });

  return NextResponse.json({ post, message: `发帖成功 +${reward}积分` });
}
