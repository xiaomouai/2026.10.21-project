import { NextResponse } from "next/server";
import { z } from "zod";
import { dispatchOnce, queueHealth } from "../../../../lib/ai/dispatch";
import { resolveApiOrg } from "../../../../lib/api-auth";

/**
 * REST 调度端点：供外部 agent / 运维触发 UniCRM 的建档任务队列 [AI·NEW · P1]
 *
 * 鉴权（P3-1）：
 *   - 生产模式（配置了 UCRM_API_KEYS）：Authorization: Bearer <key>
 *   - 开发模式：请求体/查询参数 orgSlug 或 X-Org-Slug 头
 *
 * POST /api/dev/agent-dispatch  body: { orgSlug?, lane?, limit? }  → 一轮调度
 * GET  /api/dev/agent-dispatch?orgSlug=xxx                         → 队列健康
 */
export const dynamic = "force-dynamic";

const postSchema = z.object({
  orgSlug: z.string().min(1).optional(),
  lane: z.enum(["fast", "llm"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const { lane, limit } = parsed.data;

  const res = await dispatchOnce({ orgId: a.orgId, ...(lane ? { lane } : {}), ...(limit ? { limit } : {}) });
  return NextResponse.json({
    ok: true,
    released: res.released,
    picked: res.picked,
    results: res.results,
  });
}

export async function GET(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get("orgSlug") ?? undefined;
  const a = await resolveApiOrg(req, orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  return NextResponse.json({ ok: true, health: await queueHealth(a.orgId) });
}
