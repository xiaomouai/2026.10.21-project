import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { adminGuard } from "@/lib/admin";
import { Topic } from "@/lib/types";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 生成 slug：英文/数字透传，中文等非 ASCII 回退为时间戳短码
function toSlug(raw: string, fallbackSeed: string): string {
  const cleaned = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (/[a-z0-9]/.test(cleaned) && !/[\u4e00-\u9fa5]/.test(cleaned)) return cleaned;
  return fallbackSeed;
}

export async function POST(req: NextRequest) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const category = String(body.category ?? "").trim();

  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "正文不能为空" }, { status: 400 });
  if (!category) return NextResponse.json({ error: "分类不能为空" }, { status: 400 });

  // 摘要缺省取正文首段
  const excerpt =
    String(body.excerpt ?? "").trim() ||
    content.replace(/[#>*`\-\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 68);

  const id = "t-" + Math.random().toString(36).slice(2, 9);
  let slug = toSlug(String(body.slug ?? ""), `kb-${Date.now().toString(36)}`);
  if (db.getTopicBySlug(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;

  const topic: Topic = {
    id,
    slug,
    title,
    category,
    excerpt,
    content,
    isPremium: !!body.isPremium,
    authorId: body.authorId || g.user.id,
    createdAt: new Date().toISOString(),
    views: 0,
  };
  db.createTopic(topic);

  return NextResponse.json({ ok: true, topic, message: `已创建教程《${title}》` });
}
