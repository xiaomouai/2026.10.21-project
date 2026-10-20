"use server";

import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";
import { dispatchOnce } from "../ai/dispatch";
import { enqueueDraftTask } from "../ai/dispatch";
import type { DraftResult, DraftTargetType } from "../ai/draft";

/**
 * 邮件草稿生成 · Server Action [AI·NEW · P2-3]
 * 会话鉴权 + 跨租户隔离；默认走 fast 泳道（规则模板，不依赖外部模型）。
 */
export async function generateDraftAction(
  slug: string,
  targetType: DraftTargetType,
  targetId: string,
): Promise<DraftResult & { error?: string }> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const { deduped } = await enqueueDraftTask({ orgId: org.id, targetType, targetId, lane: "fast" });
  await dispatchOnce({ orgId: org.id, lane: "fast", limit: 3 });

  // 读该目标最新一次草稿运行
  const run = await prisma.agentRun.findFirst({
    where: { orgId: org.id, agentName: "email-draft", idempotencyKey: { startsWith: `draft:${targetType}:${targetId}:` } },
    orderBy: { startedAt: "desc" },
  });
  if (!run) return { ok: false, error: "未能生成草稿", factCount: 0, runId: "", mode: "rule", subject: "", body: "", citations: [] };
  const res = run.result as { mode?: string; provider?: string; subject?: string; body?: string; citations?: DraftResult["citations"] } | null;

  return {
    ok: run.status === "COMPLETED",
    error: run.status === "FAILED" ? run.error ?? undefined : undefined,
    message: deduped ? "已有排队任务，复用结果" : undefined,
    factCount: 1,
    runId: run.id,
    mode: (res?.mode as "rule" | "llm") ?? "rule",
    subject: res?.subject ?? "",
    body: res?.body ?? "",
    citations: res?.citations ?? [],
  };
}

/** 读某组织最近的邮件草稿（按目标聚合，取每目标最新一封） */
export async function listDraftsAction(slug: string): Promise<
  { runId: string; targetType: string; targetId: string; subject: string; body: string; mode: string; startedAt: Date }[]
> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const runs = await prisma.agentRun.findMany({
    where: { orgId: org.id, agentName: "email-draft", status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return runs
    .map((r) => {
      const res = r.result as { subject?: string; body?: string; mode?: string; targetType?: string; targetId?: string } | null;
      const key = (r.idempotencyKey ?? "").split(":");
      return {
        runId: r.id,
        targetType: res?.targetType ?? key[1] ?? "CONTACT",
        targetId: res?.targetId ?? key[2] ?? "",
        subject: res?.subject ?? "(无主题)",
        body: res?.body ?? "",
        mode: res?.mode ?? "rule",
        startedAt: r.startedAt,
      };
    });
}
