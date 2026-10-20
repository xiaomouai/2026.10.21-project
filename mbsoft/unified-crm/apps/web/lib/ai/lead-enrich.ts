import { detectAiCapabilities, type AiCapabilities } from "./capabilities";
import { llmChat } from "./llm";
import { type EvidenceItem, type EvidenceType, EVIDENCE_WEIGHTS, bandFor, scoreEvidence } from "./evidence";
import type { AiBand } from "@ucrm/db";

/**
 * 线索建档 Agent [AI·NEW]
 *
 * 编排策略（借鉴 nextcrm-app `lib/enrichment/.../orchestrator.ts` 的「先便宜后贵」原则）：
 *   1. 本地规则兜底 → 总是先算一遍（无 Key 也能演示）
 *   2. 有 LLM 通道 → 再跑一次 LLM，合并 LLM 结果（LLM 覆盖同字段的规则结果）
 *   3. LLM 失败 → 静默回落规则结果，UI 标注已降级
 */

export type LeadInput = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  note?: string | null;
  score?: number | null;
};

export type ProposedFact = {
  field: string;
  value: string;
  confidence: number;
  band: AiBand;
  evidence: EvidenceItem[];
  sourceUrl?: string | null;
};

export type EnrichResult = {
  facts: ProposedFact[];
  mode: "llm" | "rule";
  provider: string;
  model: string;
  note: string;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
};

/** 允许 AI 提案的字段白名单（其余字段一律不动） */
const LEAD_FIELDS = new Set(["score", "note"]);
// 企业建档只补「可推断、可验证」的字段；
// phone / email / address 属联系方式，AI 不得编造，故不开放
const COMPANY_FIELDS = new Set(["industry", "size", "website"]);
const EVIDENCE_TYPES = new Set(Object.keys(EVIDENCE_WEIGHTS));

/** 行业枚举（与 onboarding 选项 + 常见扩展保持一致） */
const INDUSTRIES = [
  "贸易 / 零售",
  "制造",
  "软件 / 互联网",
  "专业服务",
  "教育培训",
  "医疗健康",
  "建筑 / 地产",
  "金融 / 保险",
  "其他",
];
const SIZES = ["1-10", "11-50", "51-200", "200+"];

/** 公共邮箱域名：不能当作官网来源 */
const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com", "qq.com", "163.com", "126.com", "outlook.com", "hotmail.com",
  "sina.com", "foxmail.com", "aliyun.com", "139.com", "icloud.com", "yeah.net",
]);

const INDUSTRY_KEYWORDS: [RegExp, string][] = [
  [/科技|网络|软件|信息|数据|智能|云|互联网|电子|数字/, "软件 / 互联网"],
  [/贸易|商贸|进出口|供应链|物流|电商|零售/, "贸易 / 零售"],
  [/制造|机械|工业|材料|化工|装备|五金|塑胶/, "制造"],
  [/教育|培训|学校|学院|研学/, "教育培训"],
  [/医疗|生物|医药|健康|医院/, "医疗健康"],
  [/建设|建筑|地产|装饰|工程/, "建筑 / 地产"],
  [/金融|投资|资本|保险|证券|基金/, "金融 / 保险"],
];

function nowIso() {
  return new Date().toISOString();
}

/** 本地规则推断（降级模式主力，也是 LLM 的兜底） */
export function inferByRules(lead: LeadInput): ProposedFact[] {
  const out: ProposedFact[] = [];
  const push = (field: string, value: string, items: EvidenceItem[], sourceUrl?: string | null) => {
    const confidence = Number(scoreEvidence(items).toFixed(3));
    const band = bandFor(confidence, items);
    if (!band) return; // <0.3 直接丢弃
    out.push({ field, value, confidence, band, evidence: items, sourceUrl: sourceUrl ?? null });
  };

  // 官网：来自线索邮箱域名（排除公共邮箱）
  if (lead.email && !PUBLIC_MAIL_DOMAINS.has(lead.email.split("@")[1]?.toLowerCase() ?? "")) {
    const domain = lead.email.split("@")[1].toLowerCase();
    push("website", domain, [
      {
        type: "official_site",
        sourceUrl: `https://${domain}`,
        snippet: `由线索邮箱 ${lead.email} 的域名推导`,
        retrievedAt: nowIso(),
      },
    ], `https://${domain}`);
  }

  // 行业 / 规模：公司名关键词
  const cn = (lead.company || lead.name || "").trim();
  if (cn) {
    for (const [re, industry] of INDUSTRY_KEYWORDS) {
      if (re.test(cn)) {
        push("industry", industry, [
          { type: "rule_infer", snippet: `公司名「${cn}」命中关键词规则`, retrievedAt: nowIso() },
        ]);
        break;
      }
    }
    if (/集团|股份|控股|总公司/.test(cn)) {
      push("size", "200+", [
        { type: "rule_infer", snippet: `公司名含「集团/股份/控股」，推定规模较大`, retrievedAt: nowIso() },
      ]);
    } else if (/有限|科技|网络|工作室/.test(cn)) {
      push("size", "11-50", [
        { type: "rule_infer", snippet: `公司名形态（有限/科技/工作室）推定中小规模`, retrievedAt: nowIso() },
      ]);
    }
  }

  // 评分建议：字段完整度 + 来源质量
  if (!lead.score) {
    let s = 0;
    const reasons: string[] = [];
    if (lead.email) { s += 25; reasons.push("有邮箱 +25"); }
    if (lead.phone) { s += 20; reasons.push("有电话 +20"); }
    if (lead.company) { s += 20; reasons.push("有公司名 +20"); }
    if (lead.source === "转介绍") { s += 25; reasons.push("来源转介绍 +25"); }
    else if (lead.source) { s += 10; reasons.push(`来源${lead.source} +10`); }
    if (s > 0) {
      push("score", String(Math.min(s, 100)), [
        { type: "rule_infer", snippet: `规则评分：${reasons.join("、")}`, retrievedAt: nowIso() },
      ]);
    }
  }

  return out;
}

function systemPromptFor(kind: "lead" | "company"): string {
  const common = `
evidence[].type 只能是：${[...EVIDENCE_TYPES].join(" / ")}
- 没有把握的字段不要输出；不要编造 sourceUrl；不要输出任何解释文字`;
  if (kind === "company") {
    return `你是企业档案补全助手。基于给定的企业信息，补全缺失字段。
只输出 JSON：{"facts":[{"field":"...","value":"...","evidence":[{"type":"...","sourceUrl":"...","snippet":"..."}]}]}
规则：
- field 只能是 industry / size / website 之一（联系方式不可由 AI 编造）
- industry 取值只能是：${INDUSTRIES.join(" / ")}
- size 取值只能是：${SIZES.join(" / ")}
- website 只输出域名（如 example.com），不要带协议头
${common}`;
  }
  return `你是 B2B 线索建档助手。基于给定的线索片段，评估线索质量并给出跟进建议。
只输出 JSON：{"facts":[{"field":"...","value":"...","evidence":[{"type":"...","sourceUrl":"...","snippet":"..."}]}]}
规则：
- field 只能是 score / note 之一
- score 是 0-100 的整数（综合来源质量与信息完整度）
- note 是一句中文跟进建议（不超过 60 字）
${common}`;
}

/** 调用 LLM（统一客户端，失败自动降级）。返回结构化 facts 或空。 */
async function callLlm(
  kind: "lead" | "company",
  payload: unknown,
): Promise<{ facts: ProposedFact[]; usage?: EnrichResult["usage"]; error?: string }> {
  const out = await llmChat({
    system: systemPromptFor(kind),
    user: JSON.stringify(payload),
    json: true,
    temperature: 0,
    timeoutMs: 30_000,
  });
  if (!out) return { facts: [], error: "LLM 不可用（已降级规则）" };
  try {
    const parsed = JSON.parse(out.content) as { facts?: unknown };
    const list = Array.isArray(parsed.facts) ? parsed.facts : [];

    const allowed = kind === "company" ? COMPANY_FIELDS : LEAD_FIELDS;
    const facts: ProposedFact[] = [];
    for (const f of list) {
      const it = f as { field?: string; value?: unknown; evidence?: unknown };
      if (!it.field || !allowed.has(it.field)) continue;
      let value = String(it.value ?? "").trim();
      if (!value) continue;
      // 枚举字段校验：不在字典内直接丢弃，避免脏数据入库
      if (it.field === "industry" && !INDUSTRIES.includes(value)) continue;
      if (it.field === "size" && !SIZES.includes(value)) continue;
      if (it.field === "website") value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (it.field === "score") {
        const n = Number(value);
        if (!Number.isFinite(n)) continue;
        value = String(Math.max(0, Math.min(100, Math.round(n))));
      }
      const evidence: EvidenceItem[] = (Array.isArray(it.evidence) ? it.evidence : []).map((e) => {
        const x = e as { type?: string; sourceUrl?: string; snippet?: string };
        const type = (EVIDENCE_TYPES.has(x.type ?? "") ? x.type : "llm_knowledge") as EvidenceType;
        return { type, sourceUrl: x.sourceUrl ?? null, snippet: x.snippet ?? null, retrievedAt: nowIso() };
      });
      if (!evidence.length) evidence.push({ type: "llm_knowledge", snippet: "模型未给出证据", retrievedAt: nowIso() });
      const confidence = Number(scoreEvidence(evidence).toFixed(3));
      const band = bandFor(confidence, evidence);
      if (!band) continue; // 低置信丢弃
      facts.push({ field: it.field, value, confidence, band, evidence, sourceUrl: evidence[0].sourceUrl ?? null });
    }
    return {
      facts,
      usage: {
        inputTokens: out.usage?.promptTokens ?? 0,
        outputTokens: out.usage?.completionTokens ?? 0,
      },
    };
  } catch (e) {
    return { facts: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export type CompanyInput = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  leadSource?: string | null;
};

type LlmOutcome = Awaited<ReturnType<typeof callLlm>>;

/** 按实体类型裁剪规则结果（规则层产出是全量字段） */
function filterByKind(kind: "lead" | "company", facts: ProposedFact[]): ProposedFact[] {
  const allowed = kind === "company" ? COMPANY_FIELDS : LEAD_FIELDS;
  return facts.filter((f) => allowed.has(f.field));
}

/** 合并规则结果与 LLM 结果，产出最终 EnrichResult */
function finalize(
  kind: "lead" | "company",
  ruleFacts: ProposedFact[],
  caps: AiCapabilities,
  llm: LlmOutcome,
): EnrichResult {
  const degradedBase = {
    provider: caps.available ? (caps.provider ?? "custom") : "rules-engine",
    model: caps.available ? caps.model : "rules-engine",
  };

  if (!caps.available) {
    return { facts: ruleFacts, mode: "rule", ...degradedBase, note: caps.note };
  }
  if (llm.error || !llm.facts.length) {
    return {
      facts: ruleFacts,
      mode: "rule",
      ...degradedBase,
      note: `${caps.note} · LLM 未产出有效结果（${llm.error || "空结果"}），已回落本地规则`,
      error: llm.error,
    };
  }

  // 合并：LLM 优先，同字段以 LLM 结果为准
  const merged = new Map<string, ProposedFact>();
  for (const f of ruleFacts) merged.set(f.field, f);
  for (const f of llm.facts) merged.set(f.field, f);

  return {
    facts: [...merged.values()],
    mode: "llm",
    ...degradedBase,
    note: caps.note,
    usage: llm.usage,
  };
}

/** 线索建档：评分建议 + 跟进建议 */
export async function buildLeadFacts(lead: LeadInput): Promise<EnrichResult> {
  const caps = await detectAiCapabilities();
  const ruleFacts = filterByKind("lead", inferByRules(lead));
  const llm = caps.available ? await callLlm("lead", lead) : { facts: [] };
  return finalize("lead", ruleFacts, caps, llm);
}

/**
 * fast 泳道（P1 双泳道）：只跑本地规则，绝不调用模型。
 * 用于批量建档、预算受控场景 —— 便宜、确定、不依赖外部 Key。
 */
export function buildFactsByRules(
  kind: "lead" | "company",
  payload: LeadInput | CompanyInput,
): EnrichResult {
  const lead = payload as LeadInput;
  const company = payload as CompanyInput;
  const ruleFacts = filterByKind(
    kind,
    inferByRules({
      id: payload.id,
      name: payload.name,
      company: kind === "lead" ? (lead.company ?? null) : payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      source: (lead.source ?? company.leadSource ?? null) as string | null,
      note: payload.note ?? null,
      score: null,
    }),
  );
  return {
    facts: ruleFacts,
    mode: "rule",
    provider: "rules-engine",
    model: "rules-engine",
    note: "fast 泳道：仅本地规则推断（未调用模型）",
  };
}

/** 企业建档：行业 / 规模 / 官网（联系方式不开放，防编造） */
export async function buildCompanyFacts(company: CompanyInput): Promise<EnrichResult> {
  const caps = await detectAiCapabilities();
  const ruleFacts = filterByKind(
    "company",
    inferByRules({
      id: company.id,
      name: company.name,
      company: company.name,
      email: company.email,
      phone: company.phone,
      source: company.leadSource,
      note: company.note,
      score: null,
    }),
  );
  const llm = caps.available ? await callLlm("company", company) : { facts: [] };
  return finalize("company", ruleFacts, caps, llm);
}
