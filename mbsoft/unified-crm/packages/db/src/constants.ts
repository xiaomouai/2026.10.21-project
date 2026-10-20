// 领域常量字典（前后端共享）。
// 状态用 String 存储（schema 约定），此处统一标签与展示语义，避免散落魔法值。
// 命名空间与两套上游语义对齐：CRM 业务 + Agent 运行时 + 编码任务日志。

// ---------- CRM ----------

export const COMPANY_STATUS = {
  ACTIVE: "正常",
  INACTIVE: "停用",
  PROSPECT: "潜在",
  CHURNED: "流失",
} as const;

export const LEAD_STATUS = {
  NEW: "新线索",
  CONTACTED: "已联系",
  QUALIFIED: "已合格",
  UNQUALIFIED: "不合格",
  CONVERTED: "已转化",
  LOST: "已流失",
} as const;

export const OPPORTUNITY_STAGE = {
  QUALIFICATION: "初步沟通",
  ANALYSIS: "需求分析",
  PROPOSAL: "方案报价",
  NEGOTIATION: "商务谈判",
  WON: "赢单",
  LOST: "输单",
} as const;

export const ACTIVITY_TYPE = {
  CALL: "电话",
  EMAIL: "邮件",
  MEETING: "会议",
  VISIT: "拜访",
  NOTE: "备注",
  TASK: "任务",
} as const;

/**
 * 销售 SOP 固定六阶段 [业务约定]
 * ----------------------------------------------------------------------------
 * 顺序即推进顺序：完成当前待办 → 自动创建下一阶段待办。
 * 终止条件：关联商机 WON / LOST，或客户 CHURNED，或已到最后一阶段。
 */
export const SALES_SOP = {
  FIRST_CONTACT: "首次联系",
  NEEDS: "需求确认",
  OPPORTUNITY: "创建商机",
  PROPOSAL: "方案报价",
  NEGOTIATION: "商务谈判",
  CLOSE: "成交确认",
} as const;

export type SopStage = keyof typeof SALES_SOP;

/** SOP 推进顺序（固定六阶段，取 key 顺序） */
export const SOP_STAGES = Object.keys(SALES_SOP) as SopStage[];

export const SOP_FIRST_STAGE: SopStage = "FIRST_CONTACT";
export const SOP_LAST_STAGE: SopStage = "CLOSE";

// ---------- AI Agent 运行时 ----------

export const AGENT_TASK_STATUS = {
  QUEUED: "排队中",
  RUNNING: "运行中",
  DONE: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
} as const;

export const AGENT_RUN_STATUS = {
  STARTED: "已启动",
  COMPLETED: "已完成",
  FAILED: "失败",
} as const;

// ---------- 多 Agent 编码任务日志 ----------

// 编码 agent 角色（对齐项目领地制：agent/<角色>/TASK-xxx）
export const AGENT_ROLES = [
  "lead",
  "be",
  "fe-canvas",
  "fe-ui",
  "pay",
  "qa",
  "docs",
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  lead: "架构总控",
  be: "后端",
  "fe-canvas": "前端画布",
  "fe-ui": "前端 UI",
  pay: "支付",
  qa: "验证",
  docs: "文档",
};

export const AGENT_JOB_STATUS = {
  QUEUED: "排队",
  RUNNING: "进行中",
  REVIEW: "待复核",
  BLOCKED: "受阻",
  DONE: "已完成",
  FAILED: "失败",
} as const;
export type AgentJobStatus = keyof typeof AGENT_JOB_STATUS;

export const AGENT_JOB_STATUS_LABELS: Record<AgentJobStatus, string> =
  AGENT_JOB_STATUS;

export const AGENT_JOB_PRIORITIES = {
  P0: "P0 紧急",
  P1: "P1 高",
  P2: "P2 中",
  P3: "P3 低",
} as const;
export type AgentJobPriority = keyof typeof AGENT_JOB_PRIORITIES;

// ---------- AI 事实与证据层 [AI·NEW] ----------

/** 事实提案状态机：PROPOSED → APPLIED / SUPERSEDED / DISMISSED */
export const AI_FACT_STATUS = {
  PROPOSED: "待确认",
  APPLIED: "已采纳",
  SUPERSEDED: "已取代",
  DISMISSED: "已忽略",
} as const;
export type AiFactStatus = keyof typeof AI_FACT_STATUS;

/** 置信分档（由证据权重合成，不采信 LLM 自评） */
export const AI_BAND = {
  VERIFIED: "已核实",
  PROBABLE: "较可信",
  POSSIBLE: "待验证",
} as const;
export type AiBand = keyof typeof AI_BAND;

/** 可承载 AI 提案的业务实体 */
export const AI_ENTITY_TYPE = {
  LEAD: "线索",
  COMPANY: "企业",
  CONTACT: "联系人",
} as const;
export type AiEntityType = keyof typeof AI_ENTITY_TYPE;

/** 业务记录上的 AI 建档状态 */
export const AI_STATUS = {
  NONE: "未建档",
  PENDING: "待审提案",
  ENRICHED: "已建档",
} as const;
export type AiStatus = keyof typeof AI_STATUS;

/** 未采纳原因 */
export const AI_FACT_REASON = {
  humanOwns: "人填值优先，AI 不覆盖",
  lowConfidence: "置信度不足，已丢弃",
  dismissed: "人工忽略",
  superseded: "被更新的提案取代",
} as const;
