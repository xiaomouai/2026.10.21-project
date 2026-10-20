import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@ucrm/db";
import { resolveApiOrg } from "../../../../lib/api-auth";

/**
 * REST 上报端点：供外部编码 agent 把任务状态写回 UniCRM（多 Agent 协作的首选入口）。
 *
 * 鉴权（P3-1）：
 *   - 生产模式（配置了 UCRM_API_KEYS）：Authorization: Bearer <key>
 *   - 开发模式：请求体 orgSlug 或 X-Org-Slug 头（向后兼容）
 *
 * POST /api/dev/agent-jobs  body: { orgSlug?, agentRole, taskCode?, title, description?, branch?, priority?, tags? }
 * PATCH /api/dev/agent-jobs body: { orgSlug?, jobId, status?, progress?, resultSummary?, error? }
 */
export const dynamic = "force-dynamic";

const createSchema = z.object({
  orgSlug: z.string().min(1).optional(),
  agentRole: z.string().min(1),
  taskCode: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  priority: z.string().default("P2"),
  tags: z.string().optional().nullable(),
  createdByEmail: z.string().email().optional(),
});

const patchSchema = z.object({
  orgSlug: z.string().min(1).optional(),
  jobId: z.string().min(1),
  status: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  resultSummary: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const p = parsed.data;
  const org = { id: a.orgId, slug: a.orgSlug };

  let createdById: string | undefined;
  if (p.createdByEmail) {
    const u = await prisma.user.findUnique({ where: { email: p.createdByEmail } });
    if (u) {
      const m = await prisma.organizationMember.findUnique({
        where: { orgId_userId: { orgId: org.id, userId: u.id } },
      });
      if (m) createdById = u.id;
    }
  }

  const job = await prisma.agentJob.create({
    data: {
      orgId: org.id,
      agentRole: p.agentRole,
      taskCode: p.taskCode ?? null,
      title: p.title,
      description: p.description ?? null,
      branch: p.branch ?? null,
      priority: p.priority,
      tags: p.tags ?? null,
      createdById,
    },
  });
  return NextResponse.json({ ok: true, job }, { status: 201 });
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const a = await resolveApiOrg(req, parsed.data.orgSlug);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  const p = parsed.data;
  const exist = await prisma.agentJob.findFirst({ where: { id: p.jobId, orgId: a.orgId } });
  if (!exist) return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });

  const now = new Date();
  const data: Record<string, unknown> = {};
  if (p.status !== undefined) {
    data.status = p.status;
    if (p.status === "RUNNING" || p.status === "REVIEW" || p.status === "BLOCKED") {
      if (!exist.startedAt) data.startedAt = now;
      data.finishedAt = null;
      data.durationMs = null;
    } else if (p.status === "DONE" || p.status === "FAILED") {
      if (p.status === "DONE") data.progress = 100;
      data.finishedAt = now;
      const started = exist.startedAt ?? now;
      data.durationMs = Math.max(0, now.getTime() - started.getTime());
    }
  }
  if (p.progress !== undefined) data.progress = p.progress;
  if (p.resultSummary !== undefined) data.resultSummary = p.resultSummary ?? null;
  if (p.error !== undefined) data.error = p.error ?? null;

  await prisma.agentJob.update({ where: { id: exist.id }, data });
  return NextResponse.json({ ok: true });
}
