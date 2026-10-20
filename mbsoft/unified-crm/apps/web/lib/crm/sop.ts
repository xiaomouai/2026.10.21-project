import "server-only";
import { SALES_SOP, SOP_STAGES, type SopStage } from "@ucrm/db";

/**
 * 销售 SOP 推进引擎 [结构拆分 · 从 lib/actions/crm.ts 抽出]
 * ----------------------------------------------------------------------------
 * 规则（固定六阶段）：
 *   1. 每阶段是一条 TASK 类 Activity（sopStage 记录处于哪一阶段）
 *   2. 完成当前阶段待办 → 自动创建下一阶段待办
 *   3. 已成交（WON）/ 已流失（LOST / CHURNED）→ 停止推进
 *   4. 已到最后一阶段（CLOSE）→ 不再创建
 *
 * 本模块只做纯逻辑判断 + 生成待办入参，不直接写库（写库在 server action 里做），
 * 便于单测与复用。
 */

export type SopStopReason =
  /** 该待办不属于 SOP 流程（人工登记的普通任务） */
  | "NOT_SOP"
  /** 已是最后一阶段（成交确认） */
  | "LAST_STAGE"
  /** 关联商机已赢单 */
  | "OPPORTUNITY_WON"
  /** 关联商机已输单 */
  | "OPPORTUNITY_LOST"
  /** 客户已流失 */
  | "COMPANY_CHURNED";

export const SOP_STOP_LABEL: Record<SopStopReason, string> = {
  NOT_SOP: "该任务不属于 SOP 流程，不自动推进",
  LAST_STAGE: "已到 SOP 最后一阶段，流程结束",
  OPPORTUNITY_WON: "商机已成交，停止后续 SOP 待办",
  OPPORTUNITY_LOST: "商机已流失，停止后续 SOP 待办",
  COMPANY_CHURNED: "客户已流失，停止后续 SOP 待办",
};

/** 当前阶段 → 下一阶段；已是最后一阶段或阶段非法时返回 null */
export function nextSopStage(stage: string | null | undefined): SopStage | null {
  if (!stage) return null;
  const idx = SOP_STAGES.indexOf(stage as SopStage);
  if (idx < 0) return null;
  if (idx >= SOP_STAGES.length - 1) return null;
  return SOP_STAGES[idx + 1]!;
}

/** 阶段序号（0 起）；非法阶段返回 -1 */
export function sopStageIndex(stage: string | null | undefined): number {
  return stage ? SOP_STAGES.indexOf(stage as SopStage) : -1;
}

/** 阶段中文名（带序号，如「3/6 创建商机」） */
export function sopStageLabel(stage: string | null | undefined): string {
  const idx = sopStageIndex(stage);
  if (idx < 0) return "非 SOP 任务";
  const s = SOP_STAGES[idx]!;
  return `${idx + 1}/${SOP_STAGES.length} ${SALES_SOP[s]}`;
}

export type SopContext = {
  /** 当前待办的 sopStage */
  stage: string | null | undefined;
  /** 关联商机状态：OPEN / WON / LOST */
  opportunityStatus?: string | null;
  /** 关联商机阶段：…/WON/LOST */
  opportunityStage?: string | null;
  /** 关联企业状态：ACTIVE / PROSPECT / CHURNED … */
  companyStatus?: string | null;
};

/**
 * 判断「完成当前待办后是否还应创建下一阶段待办」。
 * 返回 null = 应该推进；返回原因 = 停止推进。
 */
export function sopStopReason(ctx: SopContext): SopStopReason | null {
  if (!ctx.stage) return "NOT_SOP";
  if (sopStageIndex(ctx.stage) < 0) return "NOT_SOP";
  if (nextSopStage(ctx.stage) === null) return "LAST_STAGE";

  const oppStatus = (ctx.opportunityStatus ?? "").toUpperCase();
  const oppStage = (ctx.opportunityStage ?? "").toUpperCase();
  if (oppStatus === "WON" || oppStage === "WON") return "OPPORTUNITY_WON";
  if (oppStatus === "LOST" || oppStage === "LOST") return "OPPORTUNITY_LOST";

  if ((ctx.companyStatus ?? "").toUpperCase() === "CHURNED") return "COMPANY_CHURNED";

  return null;
}

export type PlannedSopTask = {
  stage: SopStage;
  subject: string;
};

/** 生成下一阶段待办入参；需要停止时返回 null */
export function planNextSopTask(ctx: SopContext): PlannedSopTask | null {
  if (sopStopReason(ctx) !== null) return null;
  const stage = nextSopStage(ctx.stage);
  if (!stage) return null;
  return { stage, subject: SALES_SOP[stage] };
}

/** 新客户建档后的首个待办（SOP 第一阶段：首次联系） */
export function firstSopTask(): PlannedSopTask {
  return { stage: "FIRST_CONTACT", subject: SALES_SOP.FIRST_CONTACT };
}
