import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { db } from "@/lib/store";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 知识库批量维护
// POST { action: "delete" | "premium" | "category", ids: string[], value?: boolean | string }
//   delete   —— 删除指定 id 的教程
//   premium  —— 将指定 id 设为付费(value=true)/免费(value=false)
//   category —— 将指定 id 改到新分类(value=分类名)
export async function POST(req: NextRequest) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });
  }
  const ids: string[] = body.ids.filter((x: unknown) => typeof x === "string");
  const action: string = String(body.action || "");

  let count = 0;
  if (action === "delete") {
    for (const id of ids) {
      if (db.getTopicById(id)) {
        db.deleteTopic(id);
        count++;
      }
    }
    return NextResponse.json({ ok: true, action, count, message: `已删除 ${count} 篇教程` });
  }

  if (action === "premium") {
    const v = !!body.value;
    for (const id of ids) {
      if (db.getTopicById(id)) {
        db.updateTopic(id, { isPremium: v });
        count++;
      }
    }
    return NextResponse.json({ ok: true, action, count, message: `已将 ${count} 篇设为${v ? "付费" : "免费"}` });
  }

  if (action === "category") {
    const cat = String(body.value || "").trim();
    if (!cat) return NextResponse.json({ error: "请填写新分类名" }, { status: 400 });
    for (const id of ids) {
      if (db.getTopicById(id)) {
        db.updateTopic(id, { category: cat });
        count++;
      }
    }
    return NextResponse.json({ ok: true, action, count, message: `已将 ${count} 篇移动到「${cat}」` });
  }

  return NextResponse.json({ error: "action 必须是 delete / premium / category" }, { status: 400 });
}
