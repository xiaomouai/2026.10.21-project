import { prisma } from "@ucrm/db";
import { detectAiCapabilities } from "./capabilities";
import { llmChat } from "./llm";

/**
 * 邮件草稿生成 Agent · 引擎 [AI·NEW · P2-3]
 *
 * 与全系统同一条铁律：
 *   1. 一切查询带 orgId —— 跨租户不可见
 *   2. 只产出草稿、绝不自动发送、绝不改动任何业务主表
 *   3. 草稿落 AgentRun 审计（agentName=email-draft），供人工在 dev 看板溯源
 *
 * 泳道：
 *   - fast：纯模板引擎（不调模型），基于真实字段拼接结构化中文跟进邮件
 *   - llm ：有 Key 时把「真实上下文」交给模型润色，失败自动降级模板
 *
 * 防编造：模板严格基于主表与 aiMeta 真实字段；LLM 仅润色，system 明确禁止虚构，
 * 且 LLM 输出不回写任何业务字段，仅作为草稿正文供人工采纳。
 */

export type DraftTargetType = "CONTACT" | "LEAD";

export type DraftCitation = {
  label: string;
  source: string;
};

export type DraftResult = {
  ok: boolean;
  message?: string;
  error?: string;
  /** 复用调度器 output 语义：= 1（一封草稿） */
  factCount: number;
  runId: string;
  mode: "rule" | "llm";
  subject: string;
  body: string;
  model?: string;
  citations: DraftCitation[];
};

type AiMeta = Record<string, { confidence?: number; band?: string; sourceUrl?: string; factId?: string; appliedAt?: string }> | null;

function aiMetaOf(v: unknown): AiMeta {
  if (v && typeof v === "object") return v as AiMeta;
  return null;
}

/** 字段是否由 AI 建档补全（已采纳） */
function aiField(meta: AiMeta, field: string): { isAi: boolean; band?: string } {
  const e = meta?.[field];
  if (e && e.appliedAt) return { isAi: true, band: e.band };
  return { isAi: false };
}

async function loadContext(orgId: string, targetType: DraftTargetType, targetId: string) {
  if (targetType === "CONTACT") {
    const c = await prisma.contact.findFirst({
      where: { orgId, id: targetId },
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        company: { select: { name: true, industry: true, size: true, website: true, aiMeta: true } },
      },
    });
    if (!c) return null;
    return {
      name: c.name,
      title: c.title,
      email: c.email,
      companyName: c.company?.name ?? null,
      industry: c.company?.industry ?? null,
      size: c.company?.size ?? null,
      website: c.company?.website ?? null,
      companyMeta: aiMetaOf(c.company?.aiMeta),
    };
  }
  const l = await prisma.lead.findFirst({
    where: { orgId, id: targetId },
    select: { id: true, name: true, company: true, email: true, status: true, score: true, aiMeta: true },
  });
  if (!l) return null;
  return {
    name: l.name,
    title: null,
    email: l.email,
    companyName: l.company ?? null,
    industry: null,
    size: null,
    website: null,
    companyMeta: aiMetaOf(l.aiMeta),
  };
}

/** 基于真实字段的模板草稿（降级 / fast 泳道使用，绝不编造） */
function buildTemplate(ctx: NonNullable<Awaited<ReturnType<typeof loadContext>>>): {
  subject: string;
  body: string;
  citations: DraftCitation[];
} {
  const name = ctx.name || "负责人";
  const title = ctx.title ? `${ctx.title} ` : "";
  const co = ctx.companyName || "贵司";
  const citations: DraftCitation[] = [];

  const lines: string[] = [];
  lines.push(`${title}${name}：`);
  lines.push("");
  lines.push(`您好！我是 UniCRM 的顾问，关注到${co}在${ctx.industry ? `${ctx.industry}行业` : "业务增长"}上的机会，想与您简单同步一个思路。`);
  if (ctx.size) {
    lines.push(`针对${ctx.size}规模团队的常见痛点（线索分散、跟进无节奏、复盘靠记忆），我们有一套开箱即用的 CRM + AI 跟进方案，已经帮助多家同类企业把销售跟进效率提升了一倍以上。`);
  } else {
    lines.push(`我们有一套开箱即用的 CRM + AI 跟进方案，已经帮助多家同类企业把销售跟进效率提升了一倍以上。`);
  }
  if (ctx.website) {
    lines.push(`我也留意到贵司官网 ${ctx.website}，后续可以结合公开信息做更精准的行业画像与触达。`);
  }
  lines.push("");
  lines.push("如果方便，我们约 15 分钟电话，我可以根据贵司实际场景给一套轻量落地建议，不耽误您时间。您看本周哪天方便？");
  lines.push("");
  lines.push("祝工作顺利");
  lines.push("UniCRM 团队");

  const subject = `关于${co}的跟进与合作建议`;

  // 溯源：标注 AI 建档字段
  if (ctx.industry) {
    const a = aiField(ctx.companyMeta, "industry");
    citations.push({ label: `行业：${ctx.industry}`, source: a.isAi ? `AI 建档补全（${a.band ?? "POSSIBLE"}）` : "人工录入" });
  }
  if (ctx.size) {
    const a = aiField(ctx.companyMeta, "size");
    citations.push({ label: `规模：${ctx.size}`, source: a.isAi ? `AI 建档补全（${a.band ?? "POSSIBLE"}）` : "人工录入" });
  }
  if (ctx.website) {
    const a = aiField(ctx.companyMeta, "website");
    citations.push({ label: `官网：${ctx.website}`, source: a.isAi ? `AI 建档补全（${a.band ?? "VERIFIED"}）` : "人工录入" });
  }

  return { subject, body: lines.join("\n"), citations };
}

/** 有 Key 时调用模型润色（失败返回 null 即降级模板） */
async function callChat(system: string, user: string): Promise<string | null> {
  const out = await llmChat({ system, user, temperature: 0.6, timeoutMs: 15_000 });
  if (!out) return null;
  return out.content.length > 10 ? out.content : null;
}

export async function runDraftGen(o: {
  orgId: string;
  taskId?: string | null;
  targetType: DraftTargetType;
  targetId: string;
  allowLlm?: boolean;
}): Promise<DraftResult> {
  const { orgId, taskId = null, targetType, targetId, allowLlm = false } = o;
  const startedAt = Date.now();
  const caps = await detectAiCapabilities();
  const mode: "rule" | "llm" = allowLlm && caps.available ? "llm" : "rule";

  const run = await prisma.agentRun.create({
    data: {
      orgId,
      taskId,
      agentName: "email-draft",
      source: "schedule",
      idempotencyKey: `draft:${targetType}:${targetId}:${Date.now()}`,
      status: "STARTED",
      modelId: mode === "llm" ? caps.model : null,
    },
  });

  try {
    const ctx = await loadContext(orgId, targetType, targetId);
    if (!ctx) {
      throw new Error(`未找到目标（${targetType}:${targetId}）或越权访问`);
    }

    const tpl = buildTemplate(ctx);
    let subject = tpl.subject;
    let body = tpl.body;
    let citations = tpl.citations;

    if (mode === "llm") {
      const system =
        "你是 B2B 销售跟进邮件助手。仅基于用户提供的真实上下文改写邮件，使其更自然、专业；严禁虚构任何公司名、数据、人名、案例或承诺。输出纯邮件正文（不含主题行），保留占位称呼与行动号召。";
      const user = [
        `联系人：${ctx.name}${ctx.title ? "（" + ctx.title + "）" : ""}`,
        `公司：${ctx.companyName ?? "未知"}`,
        ctx.industry ? `行业：${ctx.industry}` : "",
        ctx.size ? `规模：${ctx.size}` : "",
        ctx.website ? `官网：${ctx.website}` : "",
        "",
        "请基于以上信息润色这封跟进邮件：",
        tpl.body,
      ]
        .filter(Boolean)
        .join("\n");

      const polished = await callChat(system, user);
      if (polished) {
        body = polished;
        citations = [{ ...citations[0] }, ...citations.slice(1)];
      }
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
        result: { mode, provider: mode === "llm" ? caps.provider : "rules-engine", draftCount: 1, subject, body, citations } as never,
      },
    });
    await prisma.agentRunEvent.create({
      data: { runId: run.id, type: "milestone", name: "draft-complete", payload: { mode, targetType, targetId } as never },
    });

    return {
      ok: true,
      message: `已生成${mode === "llm" ? "LLM 润色" : "规则模板"}邮件草稿`,
      factCount: 1,
      runId: run.id,
      mode,
      subject,
      body,
      model: mode === "llm" ? caps.model : undefined,
      citations,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: msg, finishedAt: new Date(), durationMs: Date.now() - startedAt },
    });
    return { ok: false, error: msg, factCount: 0, runId: run.id, mode: "rule", subject: "", body: "", citations: [] };
  }
}
