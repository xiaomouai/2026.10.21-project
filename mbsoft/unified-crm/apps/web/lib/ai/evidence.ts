import type { AiBand } from "@ucrm/db";

/**
 * 证据账本 [AI·NEW]
 *
 * 借鉴 crm/ (Comp AI) `agent/lib/evidence.ts`：
 *   - 置信度**外部定价**：由「证据类型权重表」合成，绝不采信 LLM 自评
 *   - 噪声独立合成：score = 1 - Π(1 - wᵢ)
 *   - 存在矛盾证据 → 压到 0.45（不允许高置信）
 *   - 分档门槛：<0.3 直接丢弃，不入库
 */

export type EvidenceType =
  | "user_provided"
  | "gov_registry"
  | "official_site"
  | "third_party_db"
  | "news"
  | "social"
  | "llm_knowledge"
  | "rule_infer";

export type EvidenceItem = {
  type: EvidenceType;
  weight?: number;
  sourceUrl?: string | null;
  snippet?: string | null;
  retrievedAt?: string;
  /** 与其他证据矛盾，命中后整体置信度封顶 0.45 */
  contradiction?: boolean;
};

/** 证据权重表：数值 = 该来源可信度（外部定价，不来自模型） */
export const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  user_provided: 1.0,
  gov_registry: 0.9,
  official_site: 0.85,
  third_party_db: 0.8,
  news: 0.6,
  social: 0.5,
  llm_knowledge: 0.45,
  rule_infer: 0.4,
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  user_provided: "用户亲填",
  gov_registry: "工商/政府公开",
  official_site: "官网",
  third_party_db: "第三方数据库",
  news: "新闻媒体",
  social: "社媒/公开资料",
  llm_knowledge: "模型先验",
  rule_infer: "本地规则",
};

/** 可支撑 VERIFIED 档的证据（必须命中其一） */
const PRIMARY: EvidenceType[] = ["user_provided", "gov_registry", "official_site"];

/** 矛盾证据封顶值 */
const CONTRADICTION_CAP = 0.45;

/** 多证据独立合成：score = 1 - Π(1 - wᵢ) */
export function scoreEvidence(items: EvidenceItem[]): number {
  if (!items.length) return 0;
  let remain = 1;
  for (const it of items) {
    const w = it.weight ?? EVIDENCE_WEIGHTS[it.type] ?? 0;
    remain *= 1 - w;
  }
  const score = 1 - remain;
  const hasContradiction = items.some((i) => i.contradiction);
  return hasContradiction ? Math.min(score, CONTRADICTION_CAP) : score;
}

/**
 * 分档：
 *   VERIFIED  ≥0.85 且含 primary 证据
 *   PROBABLE  ≥0.55
 *   POSSIBLE  ≥0.30
 *   null      <0.30 → 丢弃，不入库
 */
export function bandFor(score: number, items: EvidenceItem[]): AiBand | null {
  if (score >= 0.85 && items.some((i) => PRIMARY.includes(i.type))) return "VERIFIED";
  if (score >= 0.55) return "PROBABLE";
  if (score >= 0.3) return "POSSIBLE";
  return null;
}
