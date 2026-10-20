import type { Metadata } from "next";
import Link from "next/link";
import {
  prisma,
  AGENT_JOB_STATUS,
  AGENT_ROLE_LABELS,
  COMPANY_STATUS,
  LEAD_STATUS,
  OPPORTUNITY_STAGE,
} from "@ucrm/db";
import { requireUser } from "../../../../lib/session";
import { requireOrg } from "../../../../lib/org";
import { loadDemoData } from "../../../../lib/actions/demo";
import { safeQuery } from "../../../../lib/safe";
import { buildReminders } from "../../../../lib/crm/reminders";
import {
  Card,
  PageHeader,
  StatCard,
  Badge,
  statusTone,
} from "../../../../components/ui/primitives";
import { fmtDateTime, fmtMoney, fmtDuration } from "../../../../lib/fmt";
import {
  Building2,
  Users,
  Magnet,
  Target,
  TrendingUp,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { AskCrm } from "../../../../components/ai/ai-ask-crm";
import { ReminderCenter } from "../../../../components/crm/reminder-center";

export const metadata: Metadata = { title: "销售总览" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const [companies, contacts, leads, opportunities, activities, jobCounts, recentJobs, recentActivities] =
    await Promise.all([
      prisma.company.count({ where: { orgId: org.id } }),
      prisma.contact.count({ where: { orgId: org.id } }),
      prisma.lead.count({ where: { orgId: org.id } }),
      prisma.opportunity.findMany({
        where: { orgId: org.id, status: "OPEN" },
        orderBy: { amount: "desc" },
        take: 8,
        include: { company: { select: { name: true } } },
      }),
      prisma.activity.count({ where: { orgId: org.id, status: "OPEN" } }),
      prisma.agentJob.groupBy({ by: ["status"], where: { orgId: org.id }, _count: { _all: true } }),
      prisma.agentJob.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { createdBy: { select: { name: true } } },
      }),
      prisma.activity.findMany({
        where: { orgId: org.id },
        orderBy: { happenedAt: "desc" },
        take: 5,
        include: { company: { select: { name: true } } },
      }),
    ]);

  // 提醒中心：登录工作台即直接展示（同步规则扫描，无需手动触发）
  const reminderScan = await safeQuery("提醒中心扫描", () => buildReminders(org.id, slug));

  const openLeads = leads; // leads 查询已是总数；此处区分口径
  void openLeads;
  const pipelineSum = opportunities.reduce((acc, o) => acc + Number(o.amount), 0);
  const activeJobs =
    jobCounts.filter((c) => ["RUNNING", "REVIEW", "BLOCKED"].includes(c.status)).reduce((a, c) => a + c._count._all, 0) +
    (jobCounts.find((c) => c.status === "QUEUED")?._count._all ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="销售总览"
        desc={`${org.name} · 数据按组织隔离（SaaS 租户）`}
        actions={
          companies === 0 ? (
            <form action={loadDemoData.bind(null, slug)}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                ✨ 载入演示数据
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href={`/w/${slug}/crm/companies`}>
          <StatCard label="企业客户" value={companies} icon={<Building2 className="size-4.5" />} tone="indigo" />
        </Link>
        <Link href={`/w/${slug}/crm/contacts`}>
          <StatCard label="联系人" value={contacts} icon={<Users className="size-4.5" />} tone="blue" />
        </Link>
        <Link href={`/w/${slug}/crm/leads`}>
          <StatCard label="销售线索" value={leads} icon={<Magnet className="size-4.5" />} tone="purple" />
        </Link>
        <Link href={`/w/${slug}/crm/opportunities`}>
          <StatCard label="开放商机总额" value={fmtMoney(pipelineSum)} icon={<Target className="size-4.5" />} tone="green" sub={`${opportunities.length} 个进行中`} />
        </Link>
      </div>

      <div className="mt-4">
        <AskCrm slug={slug} />
      </div>

      <div className="mt-4">
        <ReminderCenter
          scan={reminderScan.ok ? reminderScan.data : null}
          error={reminderScan.ok ? null : reminderScan.error}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* 待处理跟进 + 商机 top */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">高价值商机</h2>
            <Link href={`/w/${slug}/crm/opportunities`} className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline">
              全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          {opportunities.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">暂无开放商机</p>
          ) : (
            <ul className="space-y-2.5">
              {opportunities.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">{o.name}</p>
                    <p className="truncate text-xs text-slate-400">{o.company?.name ?? "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={statusTone(o.stage)}>{OPPORTUNITY_STAGE[o.stage as keyof typeof OPPORTUNITY_STAGE] ?? o.stage}</Badge>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{fmtMoney(o.amount, o.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <TrendingUp className="size-3.5 text-emerald-500" />
            待处理跟进 {activities} 条 · 客户 {companies} · 线索 {leads}
          </div>
        </Card>

        {/* Agent 编码任务动态 */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <ClipboardList className="size-4 text-indigo-500" />
              Agent 编码任务动态
            </h2>
            <Link href={`/w/${slug}/dev/agent-jobs`} className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline">
              任务日志 <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Object.keys(AGENT_JOB_STATUS).map((s) => {
              const n = jobCounts.find((c) => c.status === s)?._count._all ?? 0;
              return (
                <Link key={s} href={`/w/${slug}/dev/agent-jobs?status=${s}`}>
                  <Badge tone={statusTone(s)}>
                    {AGENT_JOB_STATUS[s as keyof typeof AGENT_JOB_STATUS]} {n}
                  </Badge>
                </Link>
              );
            })}
            <Badge tone="indigo" className="!bg-indigo-100">未完成 {activeJobs}</Badge>
          </div>
          {recentJobs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              暂无编码任务，去 <Link href={`/w/${slug}/dev/agent-jobs`} className="text-indigo-600">任务日志</Link> 下达
            </p>
          ) : (
            <ul className="space-y-2">
              {recentJobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">{j.title}</p>
                    <p className="text-xs text-slate-400">
                      {j.agentRole} · {AGENT_ROLE_LABELS[j.agentRole as keyof typeof AGENT_ROLE_LABELS] ?? ""} ·{" "}
                      {fmtDuration(j.durationMs)} · {fmtDateTime(j.createdAt)}
                    </p>
                  </div>
                  <Badge tone={statusTone(j.status)} className="shrink-0">
                    {AGENT_JOB_STATUS[j.status as keyof typeof AGENT_JOB_STATUS] ?? j.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">最近跟进</h2>
            <Link href={`/w/${slug}/crm/activities`} className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline">
              登记跟进 <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentActivities.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">暂无跟进记录</p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
              {recentActivities.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <p className="truncate text-[13px] font-medium text-slate-800">{a.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.company?.name ?? "—"} · {fmtDateTime(a.happenedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 模块来源说明 */}
      <p className="mt-4 text-center text-[11px] text-slate-300">
        模块来源标注：CRM 业务整合自 nextcrm-app（Accounts/Contacts/Leads/Opportunities）与 Comp AI（Deal 语义）；
        Agent 运行资产迁移自 Comp AI AgentTask/Run；编码任务日志为全新模块，本次整合过程已按多 agent 写入。
      </p>
    </div>
  );
}
