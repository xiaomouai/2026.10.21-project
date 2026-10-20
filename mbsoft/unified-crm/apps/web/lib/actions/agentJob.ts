"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";

export type JobActState = { ok: boolean; error?: string };

async function withOrg(slug: string) {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  return { user, org };
}

const str = (fd: FormData, k: string) => String(fd.get(k) || "").trim() || null;

/** lead 登记/下达一个新编码任务给某个 agent 角色 */
export async function createJob(slug: string, fd: FormData): Promise<JobActState> {
  const { user, org } = await withOrg(slug);
  const title = str(fd, "title");
  if (!title) return { ok: false, error: "请填写任务标题" };
  const agentRole = (str(fd, "agentRole") as string) || "lead";
  const priority = (str(fd, "priority") as string) || "P2";
  await prisma.agentJob.create({
    data: {
      orgId: org.id,
      agentRole,
      taskCode: str(fd, "taskCode"),
      title,
      description: str(fd, "description"),
      branch: str(fd, "branch"),
      priority,
      status: "QUEUED",
      progress: 0,
      tags: str(fd, "tags"),
      createdById: user.id,
    },
  });
  revalidatePath(`/w/${slug}/dev/agent-jobs`);
  return { ok: true };
}

/** 状态流转（自动维护 startedAt / finishedAt / durationMs） */
export async function setJobStatus(slug: string, id: string, status: string): Promise<JobActState> {
  const { user, org } = await withOrg(slug);
  const job = await prisma.agentJob.findFirst({ where: { id, orgId: org.id } });
  if (!job) return { ok: false, error: "任务不存在" };

  const now = new Date();
  const data: {
    status: string;
    progress: number;
    startedAt?: Date;
    finishedAt?: Date | null;
    durationMs?: number | null;
  } = { status, progress: job.progress };

  if (status === "RUNNING" || status === "REVIEW" || status === "BLOCKED") {
    if (!job.startedAt) {
      data.startedAt = now;
      data.progress = Math.max(job.progress, 5);
    }
    data.finishedAt = null;
    data.durationMs = null;
  } else if (status === "DONE" || status === "FAILED") {
    data.finishedAt = now;
    data.progress = status === "DONE" ? 100 : job.progress;
    if (job.startedAt) data.durationMs = now.getTime() - job.startedAt.getTime();
    else {
      data.startedAt = job.startedAt ?? now;
      data.durationMs = 0;
    }
  }

  await prisma.agentJob.update({ where: { id }, data });
  revalidatePath(`/w/${slug}/dev/agent-jobs`);
  void user;
  return { ok: true };
}

/** 更新进度/结果摘要/错误（agent 汇报用） */
export async function reportJobProgress(
  slug: string,
  id: string,
  progress: number,
  resultSummary?: string,
  error?: string
): Promise<JobActState> {
  const { org } = await withOrg(slug);
  const data: { progress: number; resultSummary?: string | null; error?: string | null } = {
    progress: Math.min(100, Math.max(0, Math.round(progress))),
  };
  if (resultSummary !== undefined) data.resultSummary = resultSummary || null;
  if (error !== undefined) data.error = error || null;
  await prisma.agentJob.updateMany({ where: { id, orgId: org.id }, data });
  revalidatePath(`/w/${slug}/dev/agent-jobs`);
  return { ok: true };
}
