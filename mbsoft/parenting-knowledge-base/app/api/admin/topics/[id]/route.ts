import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { adminGuard } from "@/lib/admin";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const cur = db.getTopicById(params.id);
  if (!cur) return NextResponse.json({ error: "教程不存在" }, { status: 404 });

  const body = await req.json();
  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
    patch.title = t;
  }
  if (body.content !== undefined) {
    const c = String(body.content).trim();
    if (!c) return NextResponse.json({ error: "正文不能为空" }, { status: 400 });
    patch.content = c;
  }
  if (body.category !== undefined) patch.category = String(body.category).trim() || cur.category;
  if (body.excerpt !== undefined) patch.excerpt = String(body.excerpt).trim() || cur.excerpt;
  if (body.isPremium !== undefined) patch.isPremium = !!body.isPremium;
  if (body.slug !== undefined) {
    const s = String(body.slug).trim();
    if (s && s !== cur.slug) {
      const dup = db.getTopicBySlug(s);
      if (dup && dup.id !== cur.id) {
        return NextResponse.json({ error: `slug「${s}」已被占用` }, { status: 400 });
      }
      patch.slug = s;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const updated = db.updateTopic(params.id, patch as any);
  return NextResponse.json({ ok: true, topic: updated, message: "已保存教程" });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const cur = db.getTopicById(params.id);
  if (!cur) return NextResponse.json({ error: "教程不存在" }, { status: 404 });

  db.deleteTopic(params.id);
  return NextResponse.json({ ok: true, message: `已删除教程《${cur.title}》` });
}
