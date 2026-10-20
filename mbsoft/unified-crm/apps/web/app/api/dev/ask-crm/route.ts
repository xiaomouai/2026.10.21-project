import { NextResponse } from "next/server";
import { z } from "zod";
import { askCrm } from "../../../../lib/ai/ask-crm";
import { resolveApiOrg } from "../../../../lib/api-auth";

/**
 * REST 查询端点：供外部 agent / 看板用自然语言问 CRM（只读）。
 *
 * 鉴权（P3-1）：
 *   - 生产模式（配置了 UCRM_API_KEYS）：Authorization: Bearer <key>
 *   - 开发模式：请求体/查询参数 orgSlug 或 X-Org-Slug 头
 *
 * POST /api/dev/ask-crm  body: { orgSlug?, question }
 * GET  /api/dev/ask-crm?orgSlug=xxx&question=yyy
 */
export const dynamic = "force-dynamic";

const schema = z.object({ orgSlug: z.string().min(1).optional(), question: z.string().min(1) });

async function handle(req: Request, orgSlug: string | undefined, question: string) {
  const a = await resolveApiOrg(req, orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const res = await askCrm(a.orgId, question);
  return NextResponse.json({
    ok: res.ok,
    intent: res.intent,
    answer: res.answer,
    mode: res.mode,
    provider: res.provider,
    model: res.model,
    citations: res.citations,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  return handle(req, parsed.data.orgSlug, parsed.data.question);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = schema.safeParse({ orgSlug: sp.get("orgSlug") ?? undefined, question: sp.get("question") ?? "" });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "question 为必填" }, { status: 400 });
  return handle(req, parsed.data.orgSlug, parsed.data.question);
}
