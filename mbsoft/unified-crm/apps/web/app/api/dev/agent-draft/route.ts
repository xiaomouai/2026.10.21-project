import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ucrm/db";
import { enqueueDraftTask, dispatchOnce } from "../../../../lib/ai/dispatch";
import { resolveApiOrg } from "../../../../lib/api-auth";

/**
 * REST 邮件草稿端点：供外部 agent / 看板触发「为某联系人/线索生成跟进邮件草稿」。
 *
 * 鉴权（P3-1）：
 *   - 生产模式（配置了 UCRM_API_KEYS）：Authorization: Bearer <key>
 *   - 开发模式：请求体/查询参数 orgSlug 或 X-Org-Slug 头
 *
 * POST /api/dev/agent-draft  body: { orgSlug?, targetType, targetId }  → 入队并调度一轮，返回草稿
 * GET  /api/dev/agent-draft?orgSlug=xxx                              → 读取最近一次生成的草稿
 */
export const dynamic = "force-dynamic";

const postSchema = z.object({
  orgSlug: z.string().min(1).optional(),
  targetType: z.enum(["CONTACT", "LEAD"]),
  targetId: z.string().min(1),
});
const getSchema = z.object({ orgSlug: z.string().min(1).optional() });

async function latest(orgId: string) {
  const run = await prisma.agentRun.findFirst({
    where: { orgId, agentName: "email-draft", status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });
  const res = run?.result as { mode?: string; subject?: string; body?: string; citations?: unknown[] } | null;
  return NextResponse.json({
    ok: true,
    subject: res?.subject ?? "",
    body: res?.body ?? "",
    mode: res?.mode ?? "rule",
    citations: (res?.citations as Record<string, string>[]) ?? [],
    runId: run?.id ?? null,
    generatedAt: run?.finishedAt?.toISOString() ?? null,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  await enqueueDraftTask({ orgId: a.orgId, targetType: parsed.data.targetType, targetId: parsed.data.targetId, lane: "fast" });
  await dispatchOnce({ orgId: a.orgId, lane: "fast", limit: 3 });
  return latest(a.orgId);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = getSchema.safeParse({ orgSlug: sp.get("orgSlug") ?? undefined });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "orgSlug 必填" }, { status: 400 });
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  return latest(a.orgId);
}
