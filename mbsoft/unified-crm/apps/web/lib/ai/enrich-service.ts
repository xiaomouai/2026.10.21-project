import { prisma } from "@ucrm/db";
import {
  buildCompanyFacts,
  buildLeadFacts,
  buildFactsByRules,
  type CompanyInput,
  type LeadInput,
} from "./lead-enrich";

/**
 * 建档执行服务 [AI·NEW · P1]
 *
 * 从 Server Action 中抽出，供两处调用：
 *   - UI 手动触发（lib/actions/aiFact.ts）
 *   - 调度器执行（lib/ai/dispatch.ts，租约队列领到的任务）
 *
 * 三条铁律不变：
 *   1. 所有查询带 orgId
 *   2. AI 永不直接改主表（这里只写 AiFact 提案）
 *   3. 人填值优先（有值且 aiMeta 无该字段 ⇒ 跳过）
 */

export type EnrichEntityType = "LEAD" | "COMPANY";

/** 各实体允许 AI 提案的字段白名单 */
export const AI_FIELDS: Record<EnrichEntityType, string[]> = {
  LEAD: ["score", "note"],
  COMPANY: ["industry", "size", "website"],
};

export type EnrichOutcome = {
  ok: boolean;
  message?: string;
  error?: string;
  factCount: number;
  runId: string;
  mode: "llm" | "rule";
};

type Meta = Record<string, unknown>;

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

/** 重算业务记录上的 AI 状态徽章 */
export async function recomputeAiStatus(orgId: string, entityType: EnrichEntityType, entityId: string) {
  const [pending, applied] = await Promise.all([
    prisma.aiFact.count({ where: { orgId, entityType, entityId, status: "PROPOSED" } }),
    prisma.aiFact.count({ where: { orgId, entityType, entityId, status: "APPLIED" } }),
  ]);
  const aiStatus = pending > 0 ? "PENDING" : applied > 0 ? "ENRICHED" : "NONE";
  if (entityType === "LEAD") {
    await prisma.lead.update({ where: { id: entityId }, data: { aiStatus } });
  } else {
    await prisma.company.update({ where: { id: entityId }, data: { aiStatus } });
  }
  return { aiStatus, pending, applied };
}

/**
 * 执行一次建档（只产出 PROPOSED 提案，不写主表）
 *
 * @param allowLlm false → 强制走规则泳道（便宜、确定、不依赖外部 Key）
 */
export async function runEnrichment(o: {
  orgId: string;
  entityType: EnrichEntityType;
  entityId: string;
  taskId?: string | null;
  source?: string;
  allowLlm?: boolean;
}): Promise<EnrichOutcome> {
  const { orgId, entityType, entityId, taskId = null, source = "manual", allowLlm = true } = o;

  const entity = await readEntity(entityType, orgId, entityId);
  if (!entity) return { ok: false, error: "记录不存在或不属于当前组织", factCount: 0, runId: "", mode: "rule" };

  const startedAt = Date.now();
  const run = await prisma.agentRun.create({
    data: {
      orgId,
      taskId,
      agentName: entityType === "LEAD" ? "lead-enrich" : "company-enrich",
      source,
      idempotencyKey: `enrich:${entityType}:${entityId}`,
      status: "STARTED",
    },
  });

  try {
    await prisma.agentRunEvent.create({
      data: { runId: run.id, type: "milestone", name: "plan", payload: { entityType, entityId, allowLlm } as never },
    });

    // 双泳道：fast 只跑规则，llm 才允许调用模型
    const result =
      entityType === "LEAD"
        ? allowLlm
          ? await buildLeadFacts({
              id: entityId,
              name: String(entity.name ?? ""),
              company: (entity.company as string) ?? null,
              email: (entity.email as string) ?? null,
              phone: (entity.phone as string) ?? null,
              source: (entity.source as string) ?? null,
              note: (entity.note as string) ?? null,
              score: (entity.score as number) ?? null,
            })
          : buildFactsByRules("lead", {
              id: entityId,
              name: String(entity.name ?? ""),
              company: (entity.company as string) ?? null,
              email: (entity.email as string) ?? null,
              phone: (entity.phone as string) ?? null,
              source: (entity.source as string) ?? null,
              note: (entity.note as string) ?? null,
              score: (entity.score as number) ?? null,
            } satisfies LeadInput)
        : allowLlm
          ? await buildCompanyFacts({
              id: entityId,
              name: String(entity.name ?? ""),
              website: (entity.website as string) ?? null,
              industry: (entity.industry as string) ?? null,
              size: (entity.size as string) ?? null,
              phone: (entity.phone as string) ?? null,
              email: (entity.email as string) ?? null,
              address: (entity.address as string) ?? null,
              note: (entity.note as string) ?? null,
              leadSource: (entity.leadSource as string) ?? null,
            })
          : buildFactsByRules("company", {
              id: entityId,
              name: String(entity.name ?? ""),
              website: (entity.website as string) ?? null,
              industry: (entity.industry as string) ?? null,
              size: (entity.size as string) ?? null,
              phone: (entity.phone as string) ?? null,
              email: (entity.email as string) ?? null,
              address: (entity.address as string) ?? null,
              note: (entity.note as string) ?? null,
              leadSource: (entity.leadSource as string) ?? null,
            } satisfies CompanyInput);

    // 同 key 的旧提案先作废
    await prisma.aiFact.updateMany({
      where: { orgId, entityType, entityId, status: "PROPOSED" },
      data: { status: "SUPERSEDED", reason: "superseded" },
    });

    const allowed = AI_FIELDS[entityType];
    const meta = (entity.aiMeta && typeof entity.aiMeta === "object" ? entity.aiMeta : {}) as Meta;
    let created = 0;

    for (const f of result.facts) {
      if (!allowed.includes(f.field)) continue;
      const cur = entity[f.field];
      const curStr = cur === null || cur === undefined ? "" : String(cur);
      // 人填优先：有值且非 AI 写入 ⇒ 跳过
      if (curStr !== "" && curStr !== "0" && !meta[f.field]) continue;
      // 值未变化 ⇒ 不重复提案
      if (curStr !== "" && curStr === f.value) continue;

      await prisma.aiFact.create({
        data: {
          orgId,
          entityType,
          entityId,
          field: f.field,
          value: f.value,
          currentValue: curStr === "" ? null : curStr,
          confidence: f.confidence,
          band: f.band,
          evidence: f.evidence as never,
          sourceUrl: f.sourceUrl ?? null,
          runId: run.id,
          status: "PROPOSED",
        },
      });
      created += 1;
    }

    const durationMs = Date.now() - startedAt;
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        modelId: result.model,
        durationMs,
        finishedAt: new Date(),
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        result: {
          summary: `产出 ${created} 条待确认提案`,
          mode: result.mode,
          provider: result.provider,
          model: result.model,
          note: result.note,
          factCount: created,
        } as never,
      },
    });
    await prisma.agentRunEvent.create({
      data: {
        runId: run.id,
        type: "milestone",
        name: "summary",
        payload: { mode: result.mode, factCount: created } as never,
      },
    });

    await recomputeAiStatus(orgId, entityType, entityId);
    return {
      ok: true,
      factCount: created,
      runId: run.id,
      mode: result.mode,
      message:
        created > 0
          ? `产出 ${created} 条提案（${result.mode === "llm" ? "LLM" : "规则"}${allowLlm ? "" : "·fast 泳道"}）`
          : "未发现可补全的字段",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: msg, finishedAt: new Date(), durationMs: Date.now() - startedAt },
    });
    return { ok: false, error: msg, factCount: 0, runId: run.id, mode: "rule" };
  }
}
