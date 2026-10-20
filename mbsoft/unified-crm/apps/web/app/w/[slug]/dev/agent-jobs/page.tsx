import type { Metadata } from "next";
import Link from "next/link";
import { prisma, AGENT_JOB_STATUS, AGENT_ROLE_LABELS } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import {
  Card,
  PageHeader,
  StatCard,
  Badge,
  statusTone,
  EmptyState,
} from "../../../../../components/ui/primitives";
import { NewJobModal } from "../../../../../components/agent-jobs/new-job-modal";
import { JobStatusControl } from "../../../../../components/agent-jobs/job-status-control";
import { fmtDateTime, fmtDuration } from "../../../../../lib/fmt";
import {
  ClipboardList,
  GitBranch,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";

export const metadata: Metadata = { title: "编码任务日志" };
export const dynamic = "force-dynamic";

const roleTone: Record<string, "indigo" | "blue" | "purple" | "cyan" | "amber" | "green" | "slate"> = {
  lead: "indigo",
  be: "blue",
  "fe-canvas": "purple",
  "fe-ui": "cyan",
  pay: "amber",
  qa: "green",
  docs: "slate",
};

export default async function AgentJobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; role?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const statusFilter = sp.status && AGENT_JOB_STATUS[sp.status as keyof typeof AGENT_JOB_STATUS]
    ? sp.status
    : undefined;
  const roleFilter = sp.role || undefined;

  const [counts, jobs] = await Promise.all([
    prisma.agentJob.groupBy({ by: ["status"], where: { orgId: org.id }, _count: { _all: true } }),
    prisma.agentJob.findMany({
      where: { orgId: org.id, ...(statusFilter ? { status: statusFilter } : {}), ...(roleFilter ? { agentRole: roleFilter } : {}) },
      orderBy: [{ createdAt: "desc" }],
      take: 80,
      include: { createdBy: { select: { name: true } } },
    }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const openCount =
    countOf("QUEUED") + countOf("RUNNING") + countOf("REVIEW") + countOf("BLOCKED");
  const total = jobs.length; // 展示总数（含过滤）
  const recentDone = jobs.filter((j) => j.status === "DONE").length;

  // 角色分布（不限状态过滤，统计全量便于排兵布阵）
  const roleAgg = await prisma.agentJob.groupBy({
    by: ["agentRole", "status"],
    where: { orgId: org.id, status: { in: ["QUEUED", "RUNNING", "REVIEW", "BLOCKED"] } },
    _count: { _all: true },
  });
  const roleOpen = new Map<string, number>();
  for (const r of roleAgg) roleOpen.set(r.agentRole, (roleOpen.get(r.agentRole) ?? 0) + r._count._all);

  const statusTabs = Object.keys(AGENT_JOB_STATUS);

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="多 Agent 编码任务日志"
        desc="本系统内的编码任务由多个 agent 角色并行推进（对齐 agent/<角色>/TASK-xxx 分支惯例），此看板统一记录状态、耗时与结果。本次「两套源码整合」即以多 agent 方式执行并写入本表。"
        actions={<NewJobModal slug={slug} />}
      />

      {/* 统计卡 */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="进行中 / 排队" value={openCount} icon={<PlayCircle className="size-4.5" />} tone="indigo" sub="QUEUED · RUNNING · REVIEW · BLOCKED" />
        <StatCard label="已看板内任务" value={total} icon={<ClipboardList className="size-4.5" />} tone="blue" sub="当前筛选范围" />
        <StatCard label="本期已完成" value={recentDone} icon={<CheckCircle2 className="size-4.5" />} tone="green" sub="DONE" />
        <StatCard label="失败" value={countOf("FAILED")} icon={<XCircle className="size-4.5" />} tone="red" sub="FAILED" />
      </div>

      {/* 角色负载 */}
      <Card className="mb-5 p-4">
        <p className="mb-2 text-[13px] font-medium text-slate-600">各角色未完成任务</p>
        <div className="flex flex-wrap gap-2">
          {[...roleOpen.entries()].length === 0 ? (
            <p className="text-xs text-slate-400">暂无未完成任务</p>
          ) : (
            [...roleOpen.entries()].map(([role, n]) => (
              <Link
                key={role}
                href={`/w/${slug}/dev/agent-jobs?role=${role}`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                <Badge tone={roleTone[role] ?? "slate"} className="!px-1">
                  {role}
                </Badge>
                <span className="text-slate-400">{AGENT_ROLE_LABELS[role as keyof typeof AGENT_ROLE_LABELS] ?? ""}</span>
                <span className="font-semibold text-slate-800">{n}</span>
              </Link>
            ))
          )}
        </div>
      </Card>

      {/* 状态筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Link
          href={`/w/${slug}/dev/agent-jobs`}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${!statusFilter ? "bg-indigo-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800"}`}
        >
          全部
        </Link>
        {statusTabs.map((s) => {
          const active = statusFilter === s;
          const label = AGENT_JOB_STATUS[s as keyof typeof AGENT_JOB_STATUS];
          return (
            <Link
              key={s}
              href={`/w/${slug}/dev/agent-jobs?status=${s}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? "bg-indigo-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800"}`}
            >
              {label} · {countOf(s)}
            </Link>
          );
        })}
        {roleFilter && (
          <Link
            href={`/w/${slug}/dev/agent-jobs`}
            className="rounded-full px-3 py-1 text-xs text-indigo-600 hover:underline"
          >
            清除角色筛选 ✕
          </Link>
        )}
      </div>

      {/* 任务卡片 */}
      {jobs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-10" />}
          title={statusFilter ? "该状态下暂无任务" : "还没有编码任务"}
          desc="点击右上角「下达任务」登记第一条，或让外部编码 agent 通过 POST /api/dev/agent-jobs 上报"
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const creator = job.createdBy?.name ?? "system";
            return (
              <Card key={job.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={roleTone[job.agentRole] ?? "slate"} className="!py-0.5">
                        {job.agentRole}
                      </Badge>
                      {job.taskCode && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                          {job.taskCode}
                        </span>
                      )}
                      <Badge tone={statusTone(job.status)}>{AGENT_JOB_STATUS[job.status as keyof typeof AGENT_JOB_STATUS] ?? job.status}</Badge>
                      <Badge tone={job.priority === "P0" ? "red" : job.priority === "P1" ? "amber" : "slate"}>
                        {job.priority}
                      </Badge>
                      {job.branch && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <GitBranch className="size-3" />
                          {job.branch}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-[15px] font-semibold text-slate-900">{job.title}</h3>
                    {job.description && (
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-slate-500">
                        {job.description}
                      </p>
                    )}
                    {job.tags && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {job.tags.split(",").map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* 进度 */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            job.status === "FAILED" ? "bg-rose-500" : job.status === "DONE" ? "bg-emerald-500" : "bg-indigo-500"
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-slate-400">{job.progress}%</span>
                      <span className="text-xs tabular-nums text-slate-400">{fmtDuration(job.durationMs)}</span>
                    </div>
                    {/* 结果/错误 */}
                    {job.resultSummary && (
                      <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 ring-1 ring-inset ring-emerald-100">
                        ✅ {job.resultSummary}
                      </div>
                    )}
                    {job.error && (
                      <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 font-mono text-[12px] text-rose-700 ring-1 ring-inset ring-rose-100">
                        {job.error}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <JobStatusControl slug={slug} jobId={job.id} status={job.status} />
                    <div className="text-right text-[11px] leading-relaxed text-slate-400">
                      <p>下达：{fmtDateTime(job.createdAt)} · {creator}</p>
                      {job.startedAt && <p>开始：{fmtDateTime(job.startedAt)}</p>}
                      {job.finishedAt && <p>结束：{fmtDateTime(job.finishedAt)}</p>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* REST 接入说明 */}
      <Card className="mt-6 border-dashed p-4">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-600">
            <Info className="size-4 text-indigo-500" />
            外部编码 agent 上报接口说明（REST）
          </summary>
          <div className="mt-3 space-y-2 rounded-lg bg-slate-900 p-4 font-mono text-[12px] leading-relaxed text-slate-100">
            <p className="text-slate-400"># 新建任务</p>
            <p>POST /api/dev/agent-jobs</p>
            <p>{`{ "orgSlug": "${org.slug}", "agentRole": "fe-ui", "title": "实现 XX", "branch": "agent/fe-ui/TASK-004-xx", "createdByEmail": "${user.email}" }`}</p>
            <p className="pt-2 text-slate-400"># 更新状态 / 汇报进度</p>
            <p>PATCH /api/dev/agent-jobs</p>
            <p>{`{ "orgSlug": "${org.slug}", "jobId": "<id>", "status": "RUNNING", "progress": 60, "resultSummary": "…" }`}</p>
          </div>
        </details>
      </Card>
    </div>
  );
}
