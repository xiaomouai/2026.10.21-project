"use server";

import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";
import { enqueueReminderScan, dispatchOnce } from "../ai/dispatch";
import { type Reminder } from "../ai/reminder";

/**
 * 跟进提醒 Agent · Server Action [AI·NEW · P2-2]
 * 会话鉴权 + 跨租户隔离。
 * 执行路径：入队（幂等）→ 调度一轮（fast 泳道立即执行）→ 读最新 AgentRun 结果返回 dashboard。
 */

export type ReminderScanResult = {
  ok: boolean;
  error?: string;
  reminders: Reminder[];
  scannedAt: string;
  runId?: string;
};

async function latestReminders(orgId: string): Promise<ReminderScanResult> {
  const latest = await prisma.agentRun.findFirst({
    where: { orgId, agentName: "followup-reminder", status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });
  const result = latest?.result as { reminders?: Reminder[] } | null;
  return {
    ok: true,
    reminders: result?.reminders ?? [],
    scannedAt: latest?.finishedAt?.toISOString() ?? "",
    runId: latest?.id,
  };
}

/** 触发一次跟进提醒扫描（入队 + 立即调度 + 返回结果） */
export async function runReminderScanAction(slug: string): Promise<ReminderScanResult> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  await enqueueReminderScan(org.id);
  await dispatchOnce({ orgId: org.id, lane: "fast" });
  return latestReminders(org.id);
}

/** 读取最近一次扫描结果（dashboard 初始加载，不重复扫描） */
export async function getRemindersAction(slug: string): Promise<ReminderScanResult> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  return latestReminders(org.id);
}
