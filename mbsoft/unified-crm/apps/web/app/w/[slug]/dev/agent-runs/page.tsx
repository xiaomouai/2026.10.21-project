import type { Metadata } from "next";
import Link from "next/link";
import { prisma, AGENT_RUN_STATUS } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState } from "../../../../../components/ui/primitives";
import { fmtDateTime, fmtDuration } from "../../../../../lib/fmt";
import { Bot, Search, Mail, Bell, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "AI 动作看板" };
export const dynamic = "force-dynamic";

/** AI 动作类型定义（泛化后的统一看板分类） */
const RUN_TYPES = [
  { key: "all", label: "全部", agentNames: [] as string[], icon: Bot },
  { key: "enrich", label: "智能建档", agentNames: ["company-enrich", "lead-enrich"], icon: Sparkles },
  { key: "ask", label: "问 CRM", agentNames: ["ask-crm"], icon: Search },
  { key: "reminder", label: "跟进提醒", agentNames: ["followup-reminder"], icon: Bell },
  { key: "draft", label: "邮件草稿", agentNames: ["email-draft"], icon: Mail },
] as const;

const AGENT_LABEL: Record<string, string> = {
  "company-enrich": "企业建档",
  "lead-enrich": "线索建档",
  "ask-crm": "问 CRM",
  "followup-reminder": "跟进提醒",
  "email-draft": "邮件草稿",
};

const AGENT_TONE: Record<string, "indigo" | "cyan" | "amber" | "purple" | "slate"> = {
  "company-enrich": "indigo",
  "lead-enrich": "indigo",
  "ask-crm": "cyan",
  "followup-reminder": "amber",
  "email-draft": "purple",
};

/** 从 result Json 提取人类可读摘要 */
function runSummary(agentName: string, result: unknown): string {
  const res = (result ?? null) as Record<string, unknown> | null;
  if (!res) return "—";
  switch (agentName) {
    case "company-enrich":
    case "lead-enrich": {
      const mode = res.mode === "llm" ? "LLM" : "规则";
      const n = typeof res.factCount === "number" ? ` · ${res.factCount} 条提案` : "";
      return `${res.summary ?? "建档完成"}（${mode}${n}）`;
    }
    case "email-draft":
      return res.subject ? `邮件主题：${String(res.subject)}（${res.mode === "llm" ? "LLM 润色" : "规则模板"}）` : "草稿已生成";
    case "followup-reminder":
      return typeof res.reminderCount === "number" ? `扫描发现 ${res.reminderCount} 条跟进提醒` : "提醒扫描完成";
    case "ask-crm": {
      const answer = typeof res.answer === "string" ? res.answer : "";
      return answer ? `问 CRM：${answer.slice(0, 64)}${answer.length > 64 ? "…" : ""}` : `意图：${String(res.intent ?? "—")}`;
    }
    default:
      return "—";
  }
}

/** 从 idempotencyKey / agentName 解析溯源链接（指向对应 CRM 模块列表页，无详情页） */
function runTrace(slug: string, agentName: string, idempotencyKey: string | null): { label: string; href: string } | null {
  const key = idempotencyKey ?? "";
  let m = /^enrich:(LEAD|COMPANY):(.+)$/.exec(key);
  if (m) {
    const seg = m[1] === "COMPANY" ? "companies" : "leads";
    const et = m[1] === "COMPANY" ? "企业" : "线索";
    return { label: `查看${et}`, href: `/w/${slug}/crm/${seg}` };
  }
  m = /^draft:(CONTACT|LEAD):([^:]+)/.exec(key);
  if (m) {
    const seg = m[1] === "CONTACT" ? "contacts" : "leads";
    const et = m[1] === "CONTACT" ? "联系人" : "线索";
    return { label: `查看${et}`, href: `/w/${slug}/crm/${seg}` };
  }
  if (agentName === "followup-reminder") {
    return { label: "查看提醒", href: `/w/${slug}/dashboard` };
  }
  return null;
}

export default async function AgentRunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const activeType = RUN_TYPES.find((t) => t.key === sp.type) ?? RUN_TYPES[0];
  const names = activeType.agentNames.length ? [...activeType.agentNames] : undefined;

  const [runs, openTasks] = await Promise.all([
    prisma.agentRun.findMany({
      where: { orgId: org.id, ...(names ? { agentName: { in: names } } : {}) },
      orderBy: { startedAt: "desc" },
      take: 40,
      include: { task: { select: { kind: true } } },
    }),
    prisma.agentTask.count({ where: { orgId: org.id, status: { in: ["QUEUED", "RUNNING"] } } }),
  ]);

  // 各动作类型最近运行数（基于当前 40 条范围内的轻量统计）
  const typeCounts = RUN_TYPES.filter((t) => t.key !== "all").map((t) => ({
    ...t,
    count: runs.filter((r) => t.agentNames.some((n) => n === r.agentName)).length,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="AI 动作看板"
        desc={`原「编码任务日志」已泛化为 AI 动作看板，统一记录智能建档 / 问 CRM / 跟进提醒 / 邮件草稿等 AI Agent 运行（模型迁移自 Comp AI 的 AgentRun）。当前排队/运行任务 ${openTasks} 个。编码类开发任务见「多 Agent 编码任务日志」。每行均带溯源链接，可跳回对应 CRM 实体。`}
      />

      {/* 类型分布卡 */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {typeCounts.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/w/${slug}/dev/agent-runs?type=${t.key}`}
              className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm transition hover:border-indigo-300 hover:text-indigo-600 ${
                activeType.key === t.key ? "border-indigo-400 text-indigo-700" : "border-slate-200 text-slate-600"
              }`}
            >
              <Icon className="size-4" />
              <span className="font-medium">{t.label}</span>
              <span className="ml-auto text-xs tabular-nums text-slate-400">{t.count}</span>
            </Link>
          );
        })}
      </div>

      {/* 类型筛选 tab */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {RUN_TYPES.map((t) => {
          const active = activeType.key === t.key;
          return (
            <Link
              key={t.key}
              href={`/w/${slug}/dev/agent-runs${t.key === "all" ? "" : `?type=${t.key}`}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active ? "bg-indigo-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={<Bot className="size-10" />}
          title={activeType.key === "all" ? "暂无 AI 运行记录" : `暂无「${activeType.label}」运行`}
          desc="在客户/线索页点「AI 智能建档」、在销售总览点「问 CRM」、在 AI 能力页触发「跟进提醒 / 邮件草稿」后，运行记录会汇总于此。"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>AI 动作</Th>
                  <Th>任务类型</Th>
                  <Th>结果摘要</Th>
                  <Th>状态</Th>
                  <Th>模型</Th>
                  <Th>耗时</Th>
                  <Th>开始时间</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const trace = runTrace(slug, r.agentName, r.idempotencyKey);
                  const tone = AGENT_TONE[r.agentName] ?? "slate";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Badge tone={tone} className="!py-0.5">
                            {AGENT_LABEL[r.agentName] ?? r.agentName}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{r.source ?? "—"}</p>
                      </Td>
                      <Td className="font-mono text-xs text-slate-500">{r.task?.kind ?? r.idempotencyKey ?? "—"}</Td>
                      <Td className="max-w-[280px]">
                        <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-600">{runSummary(r.agentName, r.result)}</p>
                        {trace && (
                          <Link
                            href={trace.href}
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                          >
                            {trace.label} ↗
                          </Link>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={statusTone(r.status)}>
                          {AGENT_RUN_STATUS[r.status as keyof typeof AGENT_RUN_STATUS] ?? r.status}
                        </Badge>
                      </Td>
                      <Td className="text-xs text-slate-500">{r.modelId ?? "—"}</Td>
                      <Td className="text-xs tabular-nums text-slate-500">{fmtDuration(r.durationMs)}</Td>
                      <Td className="text-xs text-slate-400">{fmtDateTime(r.startedAt)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
