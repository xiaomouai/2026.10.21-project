import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ucrm/db";
import { enqueueReminderScan, dispatchOnce } from "../../../../lib/ai/dispatch";
import { resolveApiOrg } from "../../../../lib/api-auth";

/**
 * REST 跟进提醒端点：供外部 agent / 看板触发「Agent 主动扫描」。
 *
 * 鉴权（P3-1）：
 *   - 生产模式（配置了 UCRM_API_KEYS）：Authorization: Bearer <key>
 *   - 开发模式：请求体/查询参数 orgSlug 或 X-Org-Slug 头
 *
 * POST /api/dev/agent-reminder  body: { orgSlug? }  → 入队并立即调度一轮，返回扫描结果
 * GET  /api/dev/agent-reminder?orgSlug=xxx          → 读取最近一次扫描结果（不重复扫描）
 */
export const dynamic = "force-dynamic";

const schema = z.object({ orgSlug: z.string().min(1).optional() });

async function latest(orgId: string) {
  const run = await prisma.agentRun.findFirst({
    where: { orgId, agentName: "followup-reminder", status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });
  const result = run?.result as { reminders?: unknown[]; reminderCount?: number } | null;
  return NextResponse.json({
    ok: true,
    reminders: (result?.reminders as Record<string, unknown>[]) ?? [],
    reminderCount: result?.reminderCount ?? 0,
    scannedAt: run?.finishedAt?.toISOString() ?? null,
    runId: run?.id ?? null,
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
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  await enqueueReminderScan(a.orgId);
  await dispatchOnce({ orgId: a.orgId, lane: "fast" });
  return latest(a.orgId);
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = schema.safeParse({ orgSlug: sp.get("orgSlug") ?? undefined });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "orgSlug 必填" }, { status: 400 });
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  return latest(a.orgId);
}
