import type { Metadata } from "next";
import { prisma, OPPORTUNITY_STAGE } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState } from "../../../../../components/ui/primitives";
import { RecordModal, type FieldCfg } from "../../../../../components/crm/record-modal";
import { QuickStatus } from "../../../../../components/crm/quick-status";
import { createOpportunity, updateOpportunityStage, updateOpportunity, deleteOpportunity } from "../../../../../lib/actions/crm";
import { DeleteButton } from "../../../../../components/crm/delete-button";
import Link from "next/link";
import { fmtDate, fmtMoney } from "../../../../../lib/fmt";
import { Target } from "lucide-react";

export const metadata: Metadata = { title: "商机" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; stage?: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const sp = await searchParams; const q = (sp.q ?? "").trim().toLowerCase(); const selectedStage = sp.stage ?? "ALL";

  const [opps, companies, contacts] = await Promise.all([
    prisma.opportunity.findMany({
      where: { orgId: org.id },
      orderBy: { updatedAt: "desc" },
      include: { company: { select: { name: true } }, contact: { select: { name: true } } },
    }),
    prisma.company.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const companyOptions = [{ value: "", label: "不关联企业" }, ...companies.map((c) => ({ value: c.id, label: c.name }))];
  const contactOptions = [{ value: "", label: "不关联联系人" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))];
  const stageOptions = Object.entries(OPPORTUNITY_STAGE).map(([value, label]) => ({ value, label }));

  const fields: FieldCfg[] = [
    { name: "name", label: "商机名称", required: true, colSpan: 2, placeholder: "例如：Q3 订货系统采购" },
    { name: "companyId", label: "客户企业", type: "select", options: companyOptions },
    { name: "contactId", label: "联系人", type: "select", options: contactOptions },
    { name: "amount", label: "金额 (元)", type: "number", defaultValue: "0" },
    { name: "stage", label: "销售阶段", type: "select", options: stageOptions, defaultValue: "QUALIFICATION" },
    { name: "probability", label: "赢单概率 %", type: "number", defaultValue: "10" },
    { name: "expectedCloseAt", label: "预计成交日", type: "date" },
    { name: "note", label: "备注", type: "textarea", colSpan: 2 },
  ];

  const openSum = opps
    .filter((o) => o.status === "OPEN")
    .reduce((acc, o) => acc + Number(o.amount), 0);
  const visibleOpps = opps.filter((o) => (selectedStage === "ALL" || o.stage === selectedStage) && (!q || [o.name, o.note, o.company?.name, o.contact?.name].some((v) => String(v ?? "").toLowerCase().includes(q))));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="商机"
        desc={`${opps.length} 个商机 · 开放中金额合计 ${fmtMoney(openSum)} · 整合 nextcrm-app Opportunities 与 Comp AI Deal 语义`}
        actions={
          <RecordModal
            slug={slug}
            title="新建商机"
            triggerText="新建商机"
            fields={fields}
            action={createOpportunity.bind(null, slug)}
          />
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2"><form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="搜索商机、客户、联系人" className="h-9 w-72 rounded-lg border border-slate-200 px-3 text-sm" />{selectedStage !== "ALL" && <input type="hidden" name="stage" value={selectedStage} />}<button className="rounded-lg bg-slate-800 px-3 text-sm text-white">搜索</button></form>{[{ value: "ALL", label: "全部" }, ...stageOptions].map((s) => <Link key={s.value} href={`/w/${slug}/crm/opportunities?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(s.value !== "ALL" ? { stage: s.value } : {}) })}`} className={`rounded-full px-3 py-1.5 text-xs ${selectedStage === s.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{s.label}</Link>)}</div>
      {visibleOpps.length === 0 ? (
        <EmptyState icon={<Target className="size-10" />} title="还没有商机" desc="从客户/线索转化，或直接录入销售机会" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>商机</Th>
                  <Th>客户 / 联系人</Th>
                  <Th>金额</Th>
                  <Th>预计成交</Th>
                  <Th>阶段</Th>
                  <Th>创建</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {visibleOpps.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <Td>
                      <p className="font-medium text-slate-900">{o.name}</p>
                      {o.note && <p className="max-w-44 truncate text-xs text-slate-400">{o.note}</p>}
                    </Td>
                    <Td className="text-[13px]">
                      {o.company?.name ?? "—"}
                      {o.contact && <span className="block text-xs text-slate-400">{o.contact.name}</span>}
                    </Td>
                    <Td className="font-medium tabular-nums text-slate-900">{fmtMoney(o.amount, o.currency)}</Td>
                    <Td className="text-[13px]">
                      {fmtDate(o.expectedCloseAt)}
                      {o.probability > 0 && o.probability < 100 && (
                        <span className="ml-1.5 text-xs text-slate-400">{o.probability}%</span>
                      )}
                    </Td>
                    <Td>
                      <QuickStatus
                        current={o.stage}
                        options={stageOptions}
                        action={updateOpportunityStage.bind(null, slug, o.id)}
                      />
                    </Td>
                    <Td className="text-xs text-slate-400">{fmtDate(o.createdAt)}</Td>
                    <Td><div className="flex items-center gap-2"><RecordModal slug={slug} title="编辑商机" triggerText="编辑" fields={fields.map((f) => ({ ...f, defaultValue: String((o as Record<string, unknown>)[f.name] ?? "") }))} action={updateOpportunity.bind(null, slug, o.id)} /><DeleteButton action={deleteOpportunity.bind(null, slug, o.id)} /></div></Td>
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
