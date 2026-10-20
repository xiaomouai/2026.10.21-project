"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";
import { runEnrichment, recomputeAiStatus, type EnrichEntityType } from "../ai/enrich-service";
import { enqueueEnrichTask, dispatchOnce, queueHealth } from "../ai/dispatch";

/**
 * AI 事实提案的 Server Actions [AI·NEW]
 *
 * 三条铁律：
 *   1. 一切查询带 orgId —— 跨租户的 fact 不可见、不可操作
 *   2. AI 永不直接改主表 —— 只有 applyFactAction 能写，且必须过闸门
 *   3. 人填值优先 —— 主表有值但 aiMeta 无该字段 ⇒ 视为人填，AI 不得覆盖
 */

export type AiActState = {
  ok: boolean;
  error?: string;
  message?: string;
  factCount?: number;
};

type AiMetaEntry = {
  confidence: number;
  band: string;
  sourceUrl?: string | null;
  factId: string;
  appliedAt: string;
};
type AiMeta = Record<string, AiMetaEntry>;

function metaOf(v: unknown): AiMeta {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as AiMeta) : {};
}

async function readEntity(entityType: EnrichEntityType, orgId: string, entityId: string) {
  if (entityType === "LEAD") {
    return (await prisma.lead.findFirst({ where: { id: entityId, orgId } })) as unknown as Record<
      string,
      unknown
    > | null;
  }
  return (await prisma.company.findFirst({ where: { id: entityId, orgId } })) as unknown as Record<
    string,
    unknown
  > | null;
}

/**
 * 写入主表（显式字段映射，禁止动态键 —— 让 tsc 能校验字段名，防止「字段不存在」在运行时才炸）
 */
async function writeField(entityType: EnrichEntityType, entityId: string, field: string, value: string) {
  if (entityType === "LEAD") {
    if (field === "score") await prisma.lead.update({ where: { id: entityId }, data: { score: Number(value) || 0 } });
    else if (field === "note") await prisma.lead.update({ where: { id: entityId }, data: { note: value } });
    else throw new Error(`LEAD 不允许写入字段 ${field}`);
    return;
  }
  if (field === "industry") await prisma.company.update({ where: { id: entityId }, data: { industry: value } });
  else if (field === "website") await prisma.company.update({ where: { id: entityId }, data: { website: value } });
  else if (field === "size") await prisma.company.update({ where: { id: entityId }, data: { size: value } });
  else throw new Error(`COMPANY 不允许写入字段 ${field}`);
}

function revalidate(slug: string, entityType: EnrichEntityType) {
  revalidatePath(`/w/${slug}/crm/${entityType === "LEAD" ? "leads" : "companies"}`);
}

function normalizeType(t: string): EnrichEntityType | null {
  const v = t.toUpperCase();
  return v === "LEAD" || v === "COMPANY" ? v : null;
}

/**
 * 手动触发建档：产出 PROPOSED 提案（不写主表）
 * 幂等：24h 内已成功建档则跳过，除非 force
 */
export async function enrichEntityAction(
  slug: string,
  entityType: string,
  entityId: string,
  force = false,
): Promise<AiActState> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const type = normalizeType(entityType);
  if (!type) return { ok: false, error: "entityType 只能是 LEAD / COMPANY" };

  const idempotencyKey = `enrich:${type}:${entityId}`;
  if (!force) {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await prisma.agentRun.findFirst({
      where: { orgId: org.id, idempotencyKey, status: "COMPLETED", startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
    });
    if (recent) return { ok: false, message: "24 小时内已建档，可点「强制重跑」" };
  }

  const task = await prisma.agentTask.create({
    data: {
      orgId: org.id,
      kind: idempotencyKey,
      lane: "llm",
      status: "RUNNING",
      input: { entityType: type, entityId, force } as never,
    },
  });

  const out = await runEnrichment({
    orgId: org.id,
    entityType: type,
    entityId,
    taskId: task.id,
    source: "manual",
    allowLlm: true,
  });

  await prisma.agentTask.update({
    where: { id: task.id },
    data: out.ok
      ? { status: "DONE", output: { factCount: out.factCount } as never }
      : { status: "FAILED", error: out.error ?? "未知错误" },
  });

  revalidate(slug, type);
  return out.ok
    ? { ok: true, message: out.message, factCount: out.factCount }
    : { ok: false, error: `建档失败：${out.error}` };
}

/**
 * 批量入队：把该组织未建档的实体压入 fast 泳道队列（由调度器执行）
 */
export async function enqueueBulkEnrichAction(slug: string, entityType: string): Promise<AiActState> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const type = normalizeType(entityType);
  if (!type) return { ok: false, error: "entityType 只能是 LEAD / COMPANY" };

  const rows =
    type === "COMPANY"
      ? await prisma.company.findMany({ where: { orgId: org.id }, select: { id: true } })
      : await prisma.lead.findMany({ where: { orgId: org.id }, select: { id: true } });

  let queued = 0;
  for (const r of rows) {
    const res = await enqueueEnrichTask({
      orgId: org.id,
      entityType: type,
      entityId: r.id,
      lane: "fast",
    });
    if (!res.deduped) queued += 1;
  }
  revalidate(slug, type);
  return { ok: true, message: `已入队 ${queued} 个任务（fast 泳道），共扫描 ${rows.length} 条记录` };
}

/** 立即触发一次调度（领取到期任务并执行）。lane 可选：fast / llm / 缺省=两条泳道都跑 */
export async function dispatchNowAction(slug: string, limit = 10, lane?: string): Promise<AiActState> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const res = await dispatchOnce({ orgId: org.id, limit, ...(lane ? { lane } : {}) });
  revalidatePath(`/w/${slug}/settings/ai`);
  revalidate(slug, "COMPANY");
  revalidate(slug, "LEAD");
  const done = res.results.filter((r) => r.ok).length;
  return {
    ok: true,
    message: `调度完成：领取 ${res.picked} 个，成功 ${done} 个，失败 ${res.results.length - done} 个`,
  };
}

export type FactRow = {
  id: string;
  field: string;
  value: string;
  currentValue: string | null;
  confidence: number;
  band: string;
  sourceUrl: string | null;
  evidence: { type: string; sourceUrl?: string | null; snippet?: string | null }[];
  status: string;
  reason: string | null;
  createdAt: string;
};

export type RunInfo = {
  mode: string;
  provider: string;
  model: string;
  durationMs: number | null;
  note: string | null;
  startedAt: string;
  status: string;
} | null;

/** 读取某条记录的 AI 提案与最近一次运行情况（供 UI 面板使用） */
export async function listFactsAction(
  slug: string,
  entityType: string,
  entityId: string,
): Promise<{ ok: boolean; facts: FactRow[]; run: RunInfo; error?: string }> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const [rows, run] = await Promise.all([
    prisma.aiFact.findMany({
      where: { orgId: org.id, entityType, entityId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.agentRun.findFirst({
      where: { orgId: org.id, idempotencyKey: `enrich:${entityType}:${entityId}` },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const facts: FactRow[] = rows.map((f) => ({
    id: f.id,
    field: f.field,
    value: f.value,
    currentValue: f.currentValue,
    confidence: f.confidence,
    band: f.band,
    sourceUrl: f.sourceUrl,
    evidence: Array.isArray(f.evidence)
      ? (f.evidence as { type: string; sourceUrl?: string | null; snippet?: string | null }[])
      : [],
    status: f.status,
    reason: f.reason,
    createdAt: f.createdAt.toISOString(),
  }));

  const r = run?.result as { mode?: string; provider?: string; note?: string } | null;
  return {
    ok: true,
    facts,
    run: run
      ? {
          mode: r?.mode ?? "rule",
          provider: r?.provider ?? "rules-engine",
          model: run.modelId ?? "rules-engine",
          durationMs: run.durationMs,
          note: r?.note ?? run.error ?? null,
          startedAt: run.startedAt.toISOString(),
          status: run.status,
        }
      : null,
  };
}

/** 采纳提案：过闸门后写入主表 */
export async function applyFactAction(slug: string, factId: string): Promise<AiActState> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const fact = await prisma.aiFact.findFirst({ where: { id: factId, orgId: org.id } });
  if (!fact) return { ok: false, error: "提案不存在或不属于当前组织" };
  if (fact.status !== "PROPOSED") {
    return { ok: false, error: `该提案已${fact.status === "APPLIED" ? "采纳" : "处理"}，无法重复操作` };
  }
  const entityType = normalizeType(fact.entityType);
  if (!entityType) return { ok: false, error: "未知的实体类型" };

  const entity = await readEntity(entityType, org.id, fact.entityId);
  if (!entity) return { ok: false, error: "关联记录不存在" };

  const meta = metaOf(entity.aiMeta);
  const cur = entity[fact.field];
  const curStr = cur === null || cur === undefined ? "" : String(cur);

  // 闸门：人填值优先（有值且非 AI 写入 ⇒ 不覆盖）
  if (curStr !== "" && curStr !== "0" && !meta[fact.field]) {
    await prisma.aiFact.update({
      where: { id: fact.id },
      data: { status: "DISMISSED", reason: "humanOwns", decidedById: user.id, decidedAt: new Date() },
    });
    revalidate(slug, entityType);
    return { ok: false, error: "该字段已有人工填写的值，AI 不覆盖（提案已标记为已忽略）" };
  }

  await writeField(entityType, fact.entityId, fact.field, fact.value);
  await prisma.aiFact.update({
    where: { id: fact.id },
    data: { status: "APPLIED", decidedById: user.id, decidedAt: new Date(), reason: null },
  });
  // 同字段其余待审提案作废
  await prisma.aiFact.updateMany({
    where: {
      orgId: org.id,
      entityType: fact.entityType,
      entityId: fact.entityId,
      field: fact.field,
      status: "PROPOSED",
    },
    data: { status: "SUPERSEDED", reason: "superseded" },
  });

  const nextMeta: AiMeta = {
    ...meta,
    [fact.field]: {
      confidence: fact.confidence,
      band: fact.band,
      sourceUrl: fact.sourceUrl,
      factId: fact.id,
      appliedAt: new Date().toISOString(),
    },
  };
  if (entityType === "LEAD") {
    await prisma.lead.update({
      where: { id: fact.entityId },
      data: { aiMeta: nextMeta as never, aiEnrichedAt: new Date() },
    });
  } else {
    await prisma.company.update({
      where: { id: fact.entityId },
      data: { aiMeta: nextMeta as never, aiEnrichedAt: new Date() },
    });
  }

  await recomputeAiStatus(org.id, entityType, fact.entityId);
  revalidate(slug, entityType);
  return { ok: true, message: `已采纳：${fact.field} = ${fact.value}` };
}

/** 忽略提案 */
export async function dismissFactAction(slug: string, factId: string): Promise<AiActState> {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const fact = await prisma.aiFact.findFirst({ where: { id: factId, orgId: org.id } });
  if (!fact) return { ok: false, error: "提案不存在或不属于当前组织" };
  if (fact.status !== "PROPOSED") return { ok: false, error: "该提案已处理" };
  const entityType = normalizeType(fact.entityType);

  await prisma.aiFact.update({
    where: { id: fact.id },
    data: { status: "DISMISSED", reason: "dismissed", decidedById: user.id, decidedAt: new Date() },
  });
  if (entityType) {
    await recomputeAiStatus(org.id, entityType, fact.entityId);
    revalidate(slug, entityType);
  }
  return { ok: true, message: "已忽略该提案" };
}

/** 队列健康（AI 能力页用） */
export async function queueHealthAction(slug: string) {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  return queueHealth(org.id);
}
