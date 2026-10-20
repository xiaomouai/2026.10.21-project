import { prisma } from "@ucrm/db";
import { llmChat } from "./llm";

/**
 * 问 CRM · 只读查询引擎 [AI·NEW · P2-1]
 *
 * 设计要点（与 P0/P1 一脉相承）：
 *   1. 一切查询带 orgId —— 跨租户不可见（隔离由调用方 requireOrg 保证）
 *   2. 只读执行 —— 引擎绝不写库（仅 askCrmAction 落一条 AgentRun 审计）
 *   3. 白名单意图 —— 只跑预定义的聚合查询，绝不拼接任意字段 / SQL，防注入与越权
 *   4. 答案溯源 —— 复用主表 aiMeta，标注「哪些是 AI 建档字段」，让 AI 答案可审计
 *   5. 降级优先 —— 无 AI_API_KEY 时规则引擎照常答（覆盖总览式提问），有 Key 仅做语言润色
 */

export type AskIntent =
  | "company_count"
  | "industry_dist"
  | "contact_count"
  | "lead_count"
  | "opportunity_agg"
  | "amount_sum"
  | "followup"
  | "top_opportunities"
  | "ai_enriched"
  | "unknown";

export type Citation = {
  entityType: string;
  entityId: string;
  field: string;
  value: string;
  confidence: number;
  band: string;
  sourceUrl: string | null;
  label: string;
};

export type AskResult = {
  ok: boolean;
  intent: AskIntent;
  answer: string;
  data?: Record<string, unknown>;
  citations: Citation[];
  mode: "llm" | "rule";
  provider?: string;
  model?: string;
};

type TimeWin = { from: Date; label: string };

const SAMPLE_QUESTIONS = [
  "我们一共有多少家企业客户？",
  "按行业分布看看客户构成",
  "当前开放商机的总金额是多少？",
  "本周有哪些商机临近成交需要跟进？",
  "金额最高的 5 个商机是哪些？",
  "AI 智能建档补全了多少条记录？",
];

// ---------------------------------------------------------------------------
// 1) 意图解析（确定性规则，不依赖模型）
// ---------------------------------------------------------------------------

function parseTime(s: string): TimeWin | null {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/(今天|今日|当天|today)/.test(s)) {
    return { from: startOfDay, label: "今天" };
  }
  if (/(本周|这周|这一周|week)/.test(s)) {
    const dow = (startOfDay.getDay() + 6) % 7; // 周一为 0
    const mon = new Date(startOfDay);
    mon.setDate(startOfDay.getDate() - dow);
    return { from: mon, label: "本周" };
  }
  if (/(本月|这个月|这月|month)/.test(s)) {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), label: "本月" };
  }
  if (/(本季度|这个季度|quarter)/.test(s)) {
    const q = Math.floor(now.getMonth() / 3);
    return { from: new Date(now.getFullYear(), q * 3, 1), label: "本季度" };
  }
  return null;
}

function parseStatus(s: string): string | null {
  if (/(活跃|active|成交中)/.test(s)) return "ACTIVE";
  if (/(潜在|prospect|还没成交|未成交)/.test(s)) return "PROSPECT";
  if (/(流失|churn|已流失)/.test(s)) return "CHURNED";
  if (/( inactive |不活跃|休眠)/.test(s)) return "INACTIVE";
  return null;
}

function parseIntent(q: string): { intent: AskIntent; time: TimeWin | null; status: string | null } {
  const s = q.toLowerCase();
  const time = parseTime(s);
  const status = parseStatus(s);
  if (/(ai|智能|机器人).*(建档|补全|富集|enrich)|(建档|补全|富集).*(ai|智能)/.test(s))
    return { intent: "ai_enriched", time, status };
  if (/(行业|分布|占比|构成|结构)/.test(s)) return { intent: "industry_dist", time, status };
  if (/(待跟进|逾期|跟进提醒|提醒我|该跟进|需要联系|要联系|临近成交|即将成交|需要跟进|快成交)/.test(s))
    return { intent: "followup", time, status };
  if (/(最大|最高|top|高价值|重要).*(商机|deal|客户|订单)/.test(s) || /(商机|deal).*(最大|最高|top|高价值)/.test(s))
    return { intent: "top_opportunities", time, status };
  if (/(金额|成交额|成交金额|营收|业绩|流水|多少钱|总额|产值|gmv|销售额)/.test(s)) return { intent: "amount_sum", time, status };
  if (/(商机|deal|pipeline|管道|漏斗|赢单率)/.test(s)) return { intent: "opportunity_agg", time, status };
  if (/(联系人|contact|人脁|人脉)/.test(s)) return { intent: "contact_count", time, status };
  if (/(线索|lead|潜客|leads)/.test(s)) return { intent: "lead_count", time, status };
  if (/(客户|公司|企业|account|账号|家数|数量)/.test(s)) return { intent: "company_count", time, status };
  return { intent: "unknown", time, status };
}

// ---------------------------------------------------------------------------
// 2) 溯源：读主表 aiMeta，标注 AI 建档字段
// ---------------------------------------------------------------------------

type MetaEntry = { confidence: number; band: string; sourceUrl?: string | null; factId: string };

function metaOf(v: unknown): Record<string, MetaEntry> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, MetaEntry>) : {};
}

/** 某实体某字段是否由 AI 写入（用于单实体溯源展示） */
async function fieldProvenance(
  orgId: string,
  entityType: "COMPANY" | "LEAD",
  entityId: string,
  field: string,
  label: string,
): Promise<Citation | null> {
  const row =
    entityType === "COMPANY"
      ? await prisma.company.findFirst({ where: { id: entityId, orgId }, select: { aiMeta: true } })
      : await prisma.lead.findFirst({ where: { id: entityId, orgId }, select: { aiMeta: true } });
  if (!row?.aiMeta) return null;
  const m = metaOf(row.aiMeta)[field];
  if (!m) return null;
  return {
    entityType,
    entityId,
    field,
    value: label,
    confidence: m.confidence,
    band: m.band,
    sourceUrl: m.sourceUrl ?? null,
    label: `${entityType === "COMPANY" ? "企业" : "线索"}字段「${field}」由 AI 建档（${m.band} · 置信 ${(m.confidence * 100).toFixed(0)}%）`,
  };
}

/** 组织级智能溯源统计（聚合类问题的统一脚注） */
async function orgAiProvenance(orgId: string): Promise<string> {
  const [c, l] = await Promise.all([
    prisma.company.count({ where: { orgId, aiStatus: "ENRICHED" } }),
    prisma.lead.count({ where: { orgId, aiStatus: "ENRICHED" } }),
  ]);
  const pending = await prisma.aiFact.count({ where: { orgId, status: "PROPOSED" } });
  return `（智能溯源：AI 已建档企业 ${c} 家、线索 ${l} 条，待审提案 ${pending} 条）`;
}

// ---------------------------------------------------------------------------
// 3) 执行器（白名单意图 → 只读聚合）
// ---------------------------------------------------------------------------

async function executeIntent(orgId: string, q: string, intent: AskIntent, time: TimeWin | null, status: string | null): Promise<AskResult> {
  const citations: Citation[] = [];

  switch (intent) {
    case "company_count": {
      const where = status ? { orgId, status } : { orgId };
      const total = await prisma.company.count({ where });
      const enriched = await prisma.company.count({ where: { orgId, aiStatus: "ENRICHED" } });
      const provenance = await orgAiProvenance(orgId);
      return {
        ok: true,
        intent,
        mode: "rule",
        data: { total, enriched, status },
        answer: `当前组织共有 ${total} 家企业客户${status ? `（筛选状态：${status}）` : ""}。其中 ${enriched} 家由 AI 智能建档补全。${provenance}`,
        citations,
      };
    }
    case "industry_dist": {
      const rows = await prisma.company.findMany({ where: { orgId }, select: { industry: true, id: true, aiMeta: true } });
      const map = new Map<string, number>();
      let unknown = 0;
      let enriched = 0;
      for (const r of rows) {
        if (r.industry) map.set(r.industry, (map.get(r.industry) ?? 0) + 1);
        else unknown += 1;
        if ((r.aiMeta as object | null)) {
          const m = metaOf(r.aiMeta).industry;
          if (m) enriched += 1;
        }
      }
      const lines = [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} 家`);
      const answer = `按行业分布：\n${lines.join("\n")}${unknown ? `\n未标注行业 ${unknown} 家` : ""}\n其中 ${enriched} 家的行业由 AI 建档补全。`;
      return { ok: true, intent, mode: "rule", data: { dist: lines }, answer, citations };
    }
    case "contact_count": {
      const total = await prisma.contact.count({ where: { orgId } });
      return { ok: true, intent, mode: "rule", data: { total }, answer: `当前组织共有 ${total} 位联系人。`, citations };
    }
    case "lead_count": {
      const rows = await prisma.lead.findMany({ where: { orgId }, select: { status: true, aiStatus: true } });
      const map = new Map<string, number>();
      let enriched = 0;
      for (const r of rows) {
        map.set(r.status, (map.get(r.status) ?? 0) + 1);
        if (r.aiStatus === "ENRICHED") enriched += 1;
      }
      const lines = [...map.entries()].map(([k, v]) => `${k} ${v} 条`).join("、");
      return {
        ok: true,
        intent,
        mode: "rule",
        data: { dist: [...map.entries()] },
        answer: `销售线索共 ${rows.length} 条（${lines}）。其中 ${enriched} 条已由 AI 评分建档。`,
        citations,
      };
    }
    case "opportunity_agg": {
      const rows = await prisma.opportunity.findMany({
        where: { orgId },
        select: { stage: true, status: true, amount: true, currency: true },
      });
      const byStage = new Map<string, { n: number; sum: number }>();
      let openSum = 0;
      for (const o of rows) {
        const cur = byStage.get(o.stage) ?? { n: 0, sum: 0 };
        cur.n += 1;
        cur.sum += Number(o.amount);
        byStage.set(o.stage, cur);
        if (o.status === "OPEN") openSum += Number(o.amount);
      }
      const lines = [...byStage.entries()].map(([k, v]) => `${k}：${v.n} 个 / ¥${v.sum.toLocaleString("zh-CN")}`);
      return {
        ok: true,
        intent,
        mode: "rule",
        data: { byStage: [...byStage.entries()], openSum },
        answer: `商机按阶段分布：\n${lines.join("\n")}\n开放商机金额合计 ¥${openSum.toLocaleString("zh-CN")}。`,
        citations,
      };
    }
    case "amount_sum": {
      const where = time
        ? { orgId, status: "OPEN", expectedCloseAt: { gte: time.from } }
        : { orgId, status: "OPEN" };
      const rows = await prisma.opportunity.findMany({ where, select: { amount: true, currency: true } });
      const sum = rows.reduce((a, o) => a + Number(o.amount), 0);
      const answer = `开放商机${time ? `（${time.label}预计成交）` : ""}金额合计 ¥${sum.toLocaleString("zh-CN")}（${rows.length} 个商机）。`;
      return { ok: true, intent, mode: "rule", data: { sum, count: rows.length }, answer, citations };
    }
    case "followup": {
      const openActivities = await prisma.activity.count({ where: { orgId, status: "OPEN" } });
      const near = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const due = await prisma.opportunity.findMany({
        where: { orgId, status: "OPEN", expectedCloseAt: { gte: new Date(), lte: near } },
        orderBy: { expectedCloseAt: "asc" },
        take: 6,
        select: { id: true, name: true, companyId: true, amount: true, expectedCloseAt: true },
      });
      const companies = await prisma.company.findMany({
        where: { orgId, id: { in: due.map((d) => d.companyId).filter(Boolean) as string[] } },
        select: { id: true, name: true },
      });
      const cname = new Map(companies.map((c) => [c.id, c.name]));
      const lines = due.map(
        (d) =>
          `· ${d.name}（${cname.get(d.companyId ?? "") ?? "—"}）¥${Number(d.amount).toLocaleString("zh-CN")} · 预计 ${d.expectedCloseAt?.toISOString().slice(0, 10)}`,
      );
      return {
        ok: true,
        intent,
        mode: "rule",
        data: { openActivities, due: due.length },
        answer: `待处理跟进活动 ${openActivities} 条。\n未来 7 天临近成交的商机 ${due.length} 个：\n${lines.join("\n") || "（暂无）"}`,
        citations,
      };
    }
    case "top_opportunities": {
      const rows = await prisma.opportunity.findMany({
        where: { orgId, status: "OPEN" },
        orderBy: { amount: "desc" },
        take: 5,
        select: { id: true, name: true, companyId: true, amount: true, stage: true },
      });
      const companies = await prisma.company.findMany({
        where: { orgId, id: { in: rows.map((r) => r.companyId).filter(Boolean) as string[] } },
        select: { id: true, name: true, aiMeta: true },
      });
      const cname = new Map(companies.map((c) => [c.id, c.name]));
      const lines = rows.map(
        (o, i) => `${i + 1}. ${o.name}（${cname.get(o.companyId ?? "") ?? "—"}）¥${Number(o.amount).toLocaleString("zh-CN")} · ${o.stage}`,
      );
      // 单实体溯源：高价值商机所属公司若行业由 AI 建档，标注
      for (const o of rows) {
        if (!o.companyId) continue;
        const c = companies.find((x) => x.id === o.companyId);
        if (!c) continue;
        const m = metaOf(c.aiMeta).industry;
        if (m)
          citations.push({
            entityType: "COMPANY",
            entityId: c.id,
            field: "industry",
            value: c.name,
            confidence: m.confidence,
            band: m.band,
            sourceUrl: m.sourceUrl ?? null,
            label: `商机「${o.name}」所属企业「${c.name}」的行业由 AI 建档（${m.band} · 置信 ${(m.confidence * 100).toFixed(0)}%）`,
          });
      }
      const provenance = await orgAiProvenance(orgId);
      return {
        ok: true,
        intent,
        mode: "rule",
        data: { top: lines },
        answer: `金额最高的 5 个开放商机：\n${lines.join("\n")}\n${provenance}`,
        citations,
      };
    }
    case "ai_enriched": {
      const [c, l, proposed, applied] = await Promise.all([
        prisma.company.count({ where: { orgId, aiStatus: "ENRICHED" } }),
        prisma.lead.count({ where: { orgId, aiStatus: "ENRICHED" } }),
        prisma.aiFact.count({ where: { orgId, status: "PROPOSED" } }),
        prisma.aiFact.count({ where: { orgId, status: "APPLIED" } }),
      ]);
      return {
        ok: true,
        intent,
        mode: "rule",
        data: { companyEnriched: c, leadEnriched: l, proposed, applied },
        answer: `AI 智能建档已补全：企业 ${c} 家、线索 ${l} 条；累计已采纳提案 ${applied} 条，待您审核 ${proposed} 条。可在「AI 能力」页查看溯源与采纳。`,
        citations,
      };
    }
    default: {
      return {
        ok: true,
        intent: "unknown",
        mode: "rule",
        data: { samples: SAMPLE_QUESTIONS },
        answer: `我还不能理解这个问题。目前支持围绕「客户 / 行业 / 联系人 / 线索 / 商机 / 金额 / 跟进 / AI 建档」的总览式提问，例如：\n${SAMPLE_QUESTIONS.map((s) => `· ${s}`).join("\n")}`,
        citations,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 4) 可选 LLM 润色（仅重写语言，不取数、不编造）
// ---------------------------------------------------------------------------

async function maybeLlmRewrite(
  question: string,
  base: string,
): Promise<{ text: string | null; provider: string; model: string }> {
  const out = await llmChat({
    system:
      "你是 CRM 数据分析助手。『系统数据』是真实查询结果，请用简洁中文回答用户问题，仅基于给定数据，不要编造任何数字或实体。控制在 70 字内，保留关键数字。",
    user: `用户问题：${question}\n系统数据：\n${base}`,
    temperature: 0.2,
    timeoutMs: 9_000,
  });
  if (!out) return { text: null, provider: "rules-engine", model: "rules-engine" };
  return { text: out.content, provider: out.provider, model: out.model };
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export async function askCrm(orgId: string, question: string): Promise<AskResult> {
  const q = (question || "").trim();
  if (!q) return { ok: false, intent: "unknown", answer: "请输入要查询的问题。", citations: [], mode: "rule" };

  const { intent, time, status } = parseIntent(q);
  const res = await executeIntent(orgId, q, intent, time, status);

  const { text, provider, model } = await maybeLlmRewrite(q, res.answer);
  if (text) {
    // LLM 润色成功：保留溯源脚注
    const probe = res.citations.length ? "\n\n🔎 " + res.citations.map((c) => c.label).join("；") : "";
    res.answer = text + probe;
    res.mode = "llm";
    res.provider = provider;
    res.model = model;
  } else {
    res.mode = "rule";
    res.provider = undefined;
    res.model = undefined;
  }
  return res;
}
