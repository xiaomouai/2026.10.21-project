"use server";

import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";
import { askCrm, type AskResult } from "../ai/ask-crm";

/**
 * 问 CRM · Server Action [AI·NEW · P2-1]
 * 会话鉴权 + 跨租户隔离；落一条 AgentRun 审计（agentName=ask-crm），便于在 dev/agent-runs 看板追溯。
 */
export async function askCrmAction(
  slug: string,
  question: string,
): Promise<AskResult & { error?: string }> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const started = Date.now();
  const run = await prisma.agentRun.create({
    data: {
      orgId: org.id,
      agentName: "ask-crm",
      source: "manual",
      status: "STARTED",
      idempotencyKey: `ask:${Date.now()}`,
    },
  });
  try {
    const res = await askCrm(org.id, question);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        durationMs: Date.now() - started,
        finishedAt: new Date(),
        result: { intent: res.intent, mode: res.mode, answer: res.answer.slice(0, 500) } as never,
      },
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: msg, finishedAt: new Date(), durationMs: Date.now() - started },
    });
    return { ok: false, intent: "unknown", answer: `查询失败：${msg}`, citations: [], mode: "rule", error: msg };
  }
}
