import type { Metadata } from "next";
import { prisma, ACTIVITY_TYPE, OPPORTUNITY_STAGE } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState } from "../../../../../components/ui/primitives";
import { RecordModal, type FieldCfg } from "../../../../../components/crm/record-modal";
import { QuickStatus } from "../../../../../components/crm/quick-status";
import { createActivity, setActivityStatus } from "../../../../../lib/actions/crm";
import { fmtDateTime } from "../../../../../lib/fmt";
import { PhoneCall } from "lucide-react";

export const metadata: Metadata = { title: "跟进活动" };
export const dynamic = "force-dynamic";

export default async function ActivitiesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const [activities, companies, opportunities] = await Promise.all([
    prisma.activity.findMany({
      where: { orgId: org.id },
      orderBy: { happenedAt: "desc" },
      take: 60,
      include: {
        company: { select: { name: true } },
        contact: { select: { name: true } },
        opportunity: { select: { name: true } },
      },
    }),
    prisma.company.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.opportunity.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const companyOptions = [{ value: "", label: "不关联" }, ...companies.map((c) => ({ value: c.id, label: c.name }))];
  const oppOptions = [{ value: "", label: "不关联" }, ...opportunities.map((o) => ({ value: o.id, label: o.name }))];
  const typeOptions = Object.entries(ACTIVITY_TYPE).map(([value, label]) => ({ value, label }));

  const fields: FieldCfg[] = [
    { name: "type", label: "类型", type: "select", options: typeOptions, defaultValue: "CALL" },
    { name: "happenedAt", label: "发生时间", type: "date" },
    { name: "plannedAt", label: "计划时间", type: "datetime-local", hint: "打算什么时候做；提醒中心按它判断「即将到期」" },
    { name: "dueAt", label: "截止时间", type: "datetime-local", hint: "最晚什么时候完成；过期进入「逾期」提醒" },
    { name: "companyId", label: "关联企业", type: "select", options: companyOptions },
    { name: "opportunityId", label: "关联商机", type: "select", options: oppOptions },
    { name: "subject", label: "主题", required: true, colSpan: 2, placeholder: "电话沟通报价方案" },
    { name: "detail", label: "详细记录", type: "textarea", colSpan: 2 },
  ];

  const typeTone: Record<string, "blue" | "amber" | "purple" | "green" | "slate" | "cyan"> = {
    CALL: "blue",
    EMAIL: "amber",
    MEETING: "purple",
    VISIT: "green",
    NOTE: "slate",
    TASK: "cyan",
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="跟进活动"
        desc="通话 / 邮件 / 会议 / 拜访等跟进流水，多态关联企业、联系人、商机"
        actions={
          <RecordModal
            slug={slug}
            title="登记跟进"
            triggerText="登记跟进"
            fields={fields}
            action={createActivity.bind(null, slug)}
          />
        }
      />
      {activities.length === 0 ? (
        <EmptyState icon={<PhoneCall className="size-10" />} title="还没有跟进记录" desc="打电话、发邮件后在这里登记，形成客户时间线" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>类型</Th>
                  <Th>主题</Th>
                  <Th>关联</Th>
                  <Th>计划 / 截止</Th>
                  <Th>发生时间</Th>
                  <Th>状态</Th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Badge tone={typeTone[a.type] ?? "slate"}>{ACTIVITY_TYPE[a.type as keyof typeof ACTIVITY_TYPE] ?? a.type}</Badge>
                    </Td>
                    <Td>
                      <p className="font-medium text-slate-900">{a.subject}</p>
                      {a.detail && <p className="max-w-72 truncate text-xs text-slate-400">{a.detail}</p>}
                    </Td>
                    <Td className="text-[13px]">
                      {[a.company?.name, a.contact?.name, a.opportunity?.name].filter(Boolean).join(" · ") || "—"}
                    </Td>
                    <Td className="text-xs text-slate-500">
                      <p>计划 {fmtDateTime(a.plannedAt)}</p>
                      <p className={a.dueAt && a.dueAt < new Date() && a.status === "OPEN" ? "text-rose-500" : "text-slate-400"}>
                        截止 {fmtDateTime(a.dueAt)}
                      </p>
                    </Td>
                    <Td className="text-xs text-slate-400">{fmtDateTime(a.happenedAt)}</Td>
                    <Td>
                      <QuickStatus
                        current={a.status}
                        options={[
                          { value: "OPEN", label: "未完成" },
                          { value: "DONE", label: "已完成" },
                        ]}
                        action={setActivityStatus.bind(null, slug, a.id)}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
