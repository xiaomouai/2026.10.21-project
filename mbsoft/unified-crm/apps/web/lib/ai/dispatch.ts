import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@ucrm/db";
import { runEnrichment, type EnrichEntityType } from "./enrich-service";
import { runReminderScan } from "./reminder";
import { runDraftGen, type DraftTargetType } from "./draft";
import { runGithubOpportunityAgent } from "./opportunity-agent";

/**
 * Agent 任务租约队列 + 双泳道调度 [AI·NEW · P1]
 *
 * 借鉴 crm/ (Comp AI) `agent/lib/tasks.ts` + `dispatch.ts`：
 *   - 租约队列：dueAt + leaseOwner + leasedUntil，进程崩溃后租约过期自动回收，无需 Redis/BullMQ
 *   - 双泳道：fast（确定性规则，便宜）与 llm（需要模型）分开调度，成本可控
 *   - 重试与退避：attempts < maxAttempts 时指数退避重排，超上限转 FAILED
 *
 * SQLite 无 FOR UPDATE SKIP LOCKED，采用「乐观领取」：
 *   先查候选 id → 用 updateMany(... AND status='QUEUED') 抢占 → 只认领到 leaseOwner=自己的那些。
 */

export const LANE = { FAST: "fast", LLM: "llm" } as const;
export const DEFAULT_LEASE_MS = 60_000;
export const DEFAULT_MAX_ATTEMPTS = 3;

export function enrichKind(entityType: EnrichEntityType, entityId: string): string {
  return `enrich:${entityType}:${entityId}`;
}

/** 入队（幂等）：同 kind 已有 QUEUED 任务则只更新 dueAt/priority，不重复排队 */
export async function enqueueEnrichTask(o: {
  orgId: string;
  entityType: EnrichEntityType;
  entityId: string;
  lane?: (typeof LANE)[keyof typeof LANE];
  priority?: number;
  delayMs?: number;
}): Promise<{ id: string; deduped: boolean }> {
  const { orgId, entityType, entityId, lane = LANE.FAST, priority = 0, delayMs = 0 } = o;
  const kind = enrichKind(entityType, entityId);
  const dueAt = new Date(Date.now() + delayMs);

  const existing = await prisma.agentTask.findFirst({ where: { orgId, kind, status: "QUEUED" } });
  if (existing) {
    await prisma.agentTask.update({
      where: { id: existing.id },
      data: { scheduledFor: dueAt, priority, lane, input: { entityType, entityId } as never },
    });
    return { id: existing.id, deduped: true };
  }

  const created = await prisma.agentTask.create({
    data: {
      orgId,
      kind,
      lane,
      status: "QUEUED",
      priority,
      scheduledFor: dueAt,
      input: { entityType, entityId } as never,
    },
  });
  return { id: created.id, deduped: false };
}

/** 入队（幂等）：同组织已有 QUEUED 的 reminder 扫描任务则不重复排队 */
export async function enqueueReminderScan(orgId: string): Promise<{ id: string; deduped: boolean }> {
  const kind = "reminder:scan";
  const existing = await prisma.agentTask.findFirst({ where: { orgId, kind, status: "QUEUED" } });
  if (existing) return { id: existing.id, deduped: true };
  const created = await prisma.agentTask.create({
    data: { orgId, kind, lane: LANE.FAST, status: "QUEUED", priority: 5, input: { orgId } as never },
  });
  return { id: created.id, deduped: false };
}

/** 入队（幂等）：同组织+同目标已有 QUEUED 的草稿任务则不重复排队 */
export async function enqueueDraftTask(o: {
  orgId: string;
  targetType: DraftTargetType;
  targetId: string;
  lane?: (typeof LANE)[keyof typeof LANE];
  priority?: number;
}): Promise<{ id: string; deduped: boolean }> {
  const { orgId, targetType, targetId, lane = LANE.FAST, priority = 3 } = o;
  const kind = `draft:${targetType}:${targetId}`;
  const existing = await prisma.agentTask.findFirst({ where: { orgId, kind, status: "QUEUED" } });
  if (existing) return { id: existing.id, deduped: true };
  const created = await prisma.agentTask.create({
    data: {
      orgId,
      kind,
      lane,
      status: "QUEUED",
      priority,
      input: { targetType, targetId } as never,
    },
  });
  return { id: created.id, deduped: false };
}

export async function enqueueGithubOpportunityTask(o: { orgId: string; query: string; priority?: number }) {
  const kind = `opportunity:github:${o.query}`;
  const existing = await prisma.agentTask.findFirst({ where: { orgId: o.orgId, kind, status: "QUEUED" } });
  if (existing) return { id: existing.id, deduped: true };
  const task = await prisma.agentTask.create({ data: { orgId: o.orgId, kind, lane: LANE.FAST, priority: o.priority ?? 5, input: { query: o.query } as never } });
  return { id: task.id, deduped: false };
}

/** 回收租约过期的任务：未达重试上限则重排，已达上限转 FAILED */
export async function releaseStale(): Promise<number> {
  const now = new Date();
  const stale = await prisma.agentTask.findMany({ where: { status: "RUNNING", leasedUntil: { lt: now } } });
  for (const t of stale) {
    if (t.attempts >= t.maxAttempts) {
      await prisma.agentTask.update({
        where: { id: t.id },
        data: { status: "FAILED", error: "租约超时且已达重试上限", leaseOwner: null, leasedUntil: null },
      });
    } else {
      await prisma.agentTask.update({
        where: { id: t.id },
        data: { status: "QUEUED", leaseOwner: null, leasedUntil: null, scheduledFor: now },
      });
    }
  }
  return stale.length;
}

/** 领取到期任务（乐观抢占，返回真正被自己领到的） */
export async function claimDue(o: {
  limit?: number;
  lane?: string;
  orgId?: string;
  leaseMs?: number;
} = {}): Promise<
  { id: string; kind: string; lane: string; attempts: number; maxAttempts: number; orgId: string; input: unknown }[]
> {
  const { limit = 5, lane, orgId, leaseMs = DEFAULT_LEASE_MS } = o;
  const now = new Date();
  const where: Prisma.AgentTaskWhereInput = {
    status: "QUEUED",
    OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    ...(lane ? { lane } : {}),
    ...(orgId ? { orgId } : {}),
  };

  const candidates = await prisma.agentTask.findMany({
    where,
    orderBy: [{ priority: "desc" }, { scheduledFor: "asc" }],
    take: limit,
    select: { id: true },
  });
  if (!candidates.length) return [];

  const owner = randomUUID();
  const ids = candidates.map((c) => c.id);
  await prisma.agentTask.updateMany({
    where: { id: { in: ids }, status: "QUEUED" },
    data: {
      status: "RUNNING",
      leaseOwner: owner,
      leasedUntil: new Date(Date.now() + leaseMs),
      attempts: { increment: 1 },
    },
  });

  const claimed = await prisma.agentTask.findMany({
    where: { id: { in: ids }, status: "RUNNING", leaseOwner: owner },
    select: { id: true, kind: true, lane: true, attempts: true, maxAttempts: true, orgId: true, input: true },
  });
  return claimed;
}

type TaskRow = Awaited<ReturnType<typeof claimDue>>[number];

/** 按 lane 分派执行：fast 只跑规则，llm 才允许调用模型 */
async function executeTask(t: TaskRow) {
  if (t.kind.startsWith("opportunity:github:")) {
    const input = (t.input ?? {}) as { query?: string };
    if (!input.query) throw new Error("GitHub 商机任务缺少 query");
    const out = await runGithubOpportunityAgent({ orgId: t.orgId, taskId: t.id, query: input.query });
    if (!out.ok) throw new Error(out.error ?? "GitHub 商机发现失败");
    return { factCount: out.created, runId: out.runId, mode: "public-github-signal", message: `读取 ${out.fetched} 条公开信号，新增 ${out.created} 条线索` };
  }
  if (t.kind.startsWith("reminder:")) {
    return runReminderScan({ orgId: t.orgId, taskId: t.id });
  }
  if (t.kind.startsWith("draft:")) {
    const m = /^draft:(CONTACT|LEAD):(.+)$/.exec(t.kind);
    if (!m) throw new Error(`无法解析草稿目标：${t.kind}`);
    const out = await runDraftGen({
      orgId: t.orgId,
      taskId: t.id,
      targetType: m[1] as DraftTargetType,
      targetId: m[2],
      allowLlm: t.lane === LANE.LLM,
    });
    if (!out.ok) throw new Error(out.error ?? "草稿生成失败");
    return out;
  }
  const input = (t.input ?? {}) as { entityType?: string; entityId?: string };
  let entityType = input.entityType;
  let entityId = input.entityId;

  if (!entityType || !entityId) {
    const m = /^enrich:(LEAD|COMPANY):(.+)$/.exec(t.kind);
    if (m) {
      entityType = m[1];
      entityId = m[2];
    }
  }
  if (!entityType || !entityId) throw new Error(`无法解析任务目标：${t.kind}`);

  const et: EnrichEntityType = entityType.toUpperCase() === "LEAD" ? "LEAD" : "COMPANY";
  const out = await runEnrichment({
    orgId: t.orgId,
    entityType: et,
    entityId,
    taskId: t.id,
    source: "schedule",
    allowLlm: t.lane === LANE.LLM,
  });
  if (!out.ok) throw new Error(out.error ?? "建档失败");
  return out;
}

export type DispatchResult = {
  released: number;
  picked: number;
  results: { id: string; kind: string; lane: string; ok: boolean; message?: string; error?: string; willRetry?: boolean }[];
};

/** 调度一轮：回收 → 领取 → 执行 → 完成/重试/失败 */
export async function dispatchOnce(o: {
  limit?: number;
  lane?: string;
  orgId?: string;
} = {}): Promise<DispatchResult> {
  const released = await releaseStale();
  const tasks = await claimDue(o);
  const results: DispatchResult["results"] = [];

  for (const t of tasks) {
    try {
      const out = await executeTask(t);
      await prisma.agentTask.update({
        where: { id: t.id },
        data: {
          status: "DONE",
          output: { factCount: out.factCount, runId: out.runId, mode: out.mode } as never,
          error: null,
          leaseOwner: null,
          leasedUntil: null,
        },
      });
      results.push({ id: t.id, kind: t.kind, lane: t.lane, ok: true, message: out.message });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const exhausted = t.attempts >= t.maxAttempts;
      const backoffMs = Math.min(30_000, 2 ** t.attempts * 1000);
      await prisma.agentTask.update({
        where: { id: t.id },
        data: exhausted
          ? { status: "FAILED", error: msg, leaseOwner: null, leasedUntil: null }
          : {
              status: "QUEUED",
              error: msg,
              leaseOwner: null,
              leasedUntil: null,
              scheduledFor: new Date(Date.now() + backoffMs),
            },
      });
      results.push({ id: t.id, kind: t.kind, lane: t.lane, ok: false, error: msg, willRetry: !exhausted });
    }
  }

  return { released, picked: tasks.length, results };
}

/** 队列健康：queued / running / stalled(租约过期) / failed / done */
export async function queueHealth(orgId?: string) {
  const base = orgId ? { orgId } : {};
  const now = new Date();
  const [queued, running, stalled, failed, done] = await Promise.all([
    prisma.agentTask.count({ where: { ...base, status: "QUEUED" } }),
    prisma.agentTask.count({ where: { ...base, status: "RUNNING", leasedUntil: { gte: now } } }),
    prisma.agentTask.count({ where: { ...base, status: "RUNNING", leasedUntil: { lt: now } } }),
    prisma.agentTask.count({ where: { ...base, status: "FAILED" } }),
    prisma.agentTask.count({ where: { ...base, status: "DONE" } }),
  ]);
  return { queued, running, stalled, failed, done };
}
