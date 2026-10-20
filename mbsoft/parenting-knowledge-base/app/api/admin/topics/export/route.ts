import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { db } from "@/lib/store";
import { serializeTopic, KB_DOC_SEP } from "@/lib/kb-import";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 知识库导出：整库序列化为单个 .md bundle（每篇用 KB_DOC_SEP 分隔）
// GET -> text/markdown 附件下载，便于本地编辑后再次导入（闭环维护）
export async function GET() {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const topics = db.getAllTopics();
  const body = topics
    .map((t) =>
      serializeTopic({
        title: t.title,
        category: t.category,
        slug: t.slug,
        excerpt: t.excerpt,
        content: t.content,
        isPremium: t.isPremium,
      })
    )
    .join(`\n\n${KB_DOC_SEP}\n\n`);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body || "# 知识库为空\n", {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="knowledge-base-${stamp}.md"`,
    },
  });
}
