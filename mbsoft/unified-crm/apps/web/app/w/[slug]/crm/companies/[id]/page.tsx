import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY_STATUS, OPPORTUNITY_STAGE, ACTIVITY_TYPE } from "@ucrm/db";
import { requireUser } from "../../../../../../lib/session";
import { requireOrg } from "../../../../../../lib/org";
import { safeQuery } from "../../../../../../lib/safe";
import { loadCompanyDetail } from "../../../../../../lib/crm/company-detail";
import { buildPublicSearchLinks, fetchPublicSiteInfo, normalizeWebsite } from "../../../../../../lib/crm/public-info";
import { sopStageLabel } from "../../../../../../lib/crm/sop";
import { setActivityStatus } from "../../../../../../lib/actions/crm";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState } from "../../../../../../components/ui/primitives";
import { QueryError, NotFoundCard } from "../../../../../../components/ui/query-error";
import { CompanyPublicInfoCard } from "../../../../../../components/crm/company-public-info-card";
import { QuickStatus } from "../../../../../../components/crm/quick-status";
import { fmtDate, fmtDateTime, fmtMoney } from "../../../../../../lib/fmt";
import { Building2, ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "企业详情" };
export const dynamic = "force-dynamic";

const typeTone: Record<string, "blue" | "amber" | "purple" | "green" | "slate" | "cyan"> = {
  CALL: "blue",
  EMAIL: "amber",
  MEETING: "purple",
  VISIT: "green",
  NOTE: "slate",
  TASK: "cyan",
};

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-[13px] text-slate-800">{value ?? <span className="text-slate-300">—</span>}</p>
    </div>
  );
}

function SectionCard({
  title,
  extra,
  children,
  action,
}: {
  title: string;
  extra?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {extra}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const detail = await safeQuery("企业详情查询", () => loadCompanyDetail(org.id, id));

  if (!detail.ok) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <PageHeader title="企业详情" />
        <QueryError title="企业详情加载失败" error={detail.error} />
      </div>
    );
  }

  const c = detail.data;
  if (!c) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <PageHeader title="企业详情" />
        <NotFoundCard
          title="未找到该客户"
          desc="客户不存在，或不属于当前组织（数据按组织隔离）。"
          backHref={`/w/${slug}/crm/companies`}
          backText="返回企业客户"
        />
      </div>
    );
  }

  // 公开信息：有官网才抓取公开页；失败不影响页面其它区块
  const website = normalizeWebsite(c.website);
  const searchLinks = buildPublicSearchLinks(c.name, c.website);
  const siteResult = website
    ? await safeQuery("官网公开信息读取", () => fetchPublicSiteInfo(website))
    : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <Link
        href={`/w/${slug}/crm/companies`}
        className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-3" />
        返回企业客户
      </Link>

      <PageHeader
        title={c.name}
        desc={`${c.industry ?? "行业未填"} · 负责人 ${c.ownerName ?? "未分配"} · 建档 ${fmtDate(c.createdAt)}`}
        actions={
          <Badge tone={statusTone(c.status)}>
            {COMPANY_STATUS[c.status as keyof typeof COMPANY_STATUS] ?? c.status}
          </Badge>
        }
      />

      {/* 概览指标 */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["联系人", c.counts.contacts],
          ["商机", c.counts.opportunities],
          ["跟进记录", c.counts.activities],
          ["待办", c.counts.openTasks],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{String(value)}</p>
          </Card>
        ))}
        <Card className="p-3">
          <p className="text-xs text-slate-500">成交 / 在谈</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {fmtMoney(c.counts.wonAmount)}
            <span className="ml-1 text-xs font-normal text-slate-400">
              / {fmtMoney(c.counts.openAmount)}
            </span>
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 基本资料 */}
        <SectionCard
          title="基本资料"
          action={
            <span className="text-[11px] text-slate-400">更新于 {fmtDate(c.updatedAt)}</span>
          }
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Item label="客户名称" value={c.name} />
            <Item label="所属行业" value={c.industry} />
            <Item label="状态" value={COMPANY_STATUS[c.status as keyof typeof COMPANY_STATUS] ?? c.status} />
            <Item label="团队规模" value={c.size} />
            <Item
              label="官网"
              value={
                website ? (
                  <a href={website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {website}
                  </a>
                ) : null
              }
            />
            <Item label="来源" value={c.leadSource} />
            <Item label="电话" value={c.phone} />
            <Item label="邮箱" value={c.email} />
            <Item label="地址" value={c.address} />
            <Item label="负责人" value={c.ownerName} />
          </div>
          {c.note && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">备注</p>
              <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-slate-700">{c.note}</p>
            </div>
          )}
        </SectionCard>

        {/* 公开信息 */}
        <CompanyPublicInfoCard
          companyName={c.name}
          website={website}
          searchLinks={searchLinks}
          site={siteResult?.ok ? siteResult.data : null}
          error={siteResult && !siteResult.ok ? siteResult.error : null}
        />
      </div>

      {/* 下一步任务 */}
      <div className="mt-4">
        <SectionCard
          title="下一步任务"
          extra={
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] text-cyan-700">
              SOP 自动推进
            </span>
          }
        >
          {c.nextTasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              暂无待办 —— 商务机已成交或流失时 SOP 会自动停止
            </p>
          ) : (
            <ul className="space-y-2">
              {c.nextTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-800">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {sopStageLabel(t.sopStage)}
                      {t.plannedAt && ` · 计划 ${fmtDateTime(t.plannedAt)}`}
                      {t.dueAt && ` · 截止 ${fmtDateTime(t.dueAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={typeTone[t.type] ?? "slate"}>
                      {ACTIVITY_TYPE[t.type as keyof typeof ACTIVITY_TYPE] ?? t.type}
                    </Badge>
                    <QuickStatus
                      current={t.status}
                      options={[
                        { value: "OPEN", label: "未完成" },
                        { value: "DONE", label: "已完成" },
                      ]}
                      action={setActivityStatus.bind(null, slug, t.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* 联系人 */}
        <SectionCard title="联系人" extra={<Badge tone="slate">{c.contacts.length}</Badge>}>
          {c.contacts.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">暂无联系人</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <Th>姓名</Th>
                    <Th>职位</Th>
                    <Th>联系方式</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.contacts.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.status === "ACTIVE" ? "在职" : "停用"}
                        </p>
                      </Td>
                      <Td className="text-[13px]">{p.title ?? "—"}</Td>
                      <Td className="text-[13px]">
                        <p>{p.phone ?? "—"}</p>
                        <p className="text-xs text-slate-400">{p.email ?? ""}</p>
                        {p.wechat && <p className="text-xs text-slate-400">微信 {p.wechat}</p>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* 商机 */}
        <SectionCard title="商机" extra={<Badge tone="slate">{c.opportunities.length}</Badge>}>
          {c.opportunities.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">暂无商机</p>
          ) : (
            <ul className="space-y-2">
              {c.opportunities.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-slate-800">{o.name}</p>
                    <p className="text-xs text-slate-400">
                      {OPPORTUNITY_STAGE[o.stage as keyof typeof OPPORTUNITY_STAGE] ?? o.stage} ·{" "}
                      {o.probability}% · 预计 {fmtDate(o.expectedCloseAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {fmtMoney(o.amount, o.currency)}
                    </span>
                    <Badge tone={statusTone(o.status)}>
                      {o.status === "WON" ? "赢单" : o.status === "LOST" ? "输单" : "进行中"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* 跟进记录 */}
      <div className="mt-4">
        <SectionCard title="跟进记录" extra={<Badge tone="slate">{c.activities.length}</Badge>}>
          {c.activities.length === 0 ? (
            <EmptyState
              icon={<Building2 className="size-10" />}
              title="还没有跟进记录"
              desc="打电话、发邮件后去「跟进活动」登记，形成客户时间线"
            />
          ) : (
            <ul className="space-y-2">
              {c.activities.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-800">
                        {a.subject}
                        {a.status === "DONE" && (
                          <span className="ml-1.5 text-[11px] text-emerald-600">已完成</span>
                        )}
                      </p>
                      {a.detail && (
                        <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{a.detail}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {[a.contactName, a.opportunityName].filter(Boolean).join(" · ") || "无关联"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={typeTone[a.type] ?? "slate"}>
                        {ACTIVITY_TYPE[a.type as keyof typeof ACTIVITY_TYPE] ?? a.type}
                      </Badge>
                      <span className="text-[11px] text-slate-400">{fmtDateTime(a.happenedAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
