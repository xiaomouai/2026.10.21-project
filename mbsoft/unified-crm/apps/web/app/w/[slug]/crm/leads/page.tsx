import type { Metadata } from "next";
import { prisma, LEAD_STATUS } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState } from "../../../../../components/ui/primitives";
import { RecordModal, type FieldCfg } from "../../../../../components/crm/record-modal";
import { QuickStatus } from "../../../../../components/crm/quick-status";
import { createLead, updateLeadStatus, updateLead, deleteLead } from "../../../../../lib/actions/crm";
import { DeleteButton } from "../../../../../components/crm/delete-button";
import Link from "next/link";
import { AiFactsButton } from "../../../../../components/ai/ai-facts-button";
import { fmtDate } from "../../../../../lib/fmt";
import { Magnet } from "lucide-react";

export const metadata: Metadata = { title: "销售线索" };
export const dynamic = "force-dynamic";

const sourceOptions = ["网站", "转介绍", "广告投放", "展会", "电话陌拜", "社群", "其他"].map((s) => ({ value: s, label: s }));

export default async function LeadsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const sp = await searchParams; const q = (sp.q ?? "").trim().toLowerCase(); const selectedStatus = sp.status ?? "ALL";

  const leads = await prisma.lead.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
  });

  // 每条线索的待审提案数（AI 建档徽章用）
  const proposedRows = await prisma.aiFact.findMany({
    where: { orgId: org.id, entityType: "LEAD", status: "PROPOSED" },
    select: { entityId: true },
  });
  const pendingMap = new Map<string, number>();
  for (const r of proposedRows) pendingMap.set(r.entityId, (pendingMap.get(r.entityId) ?? 0) + 1);

  const fields: FieldCfg[] = [
    { name: "name", label: "线索名称 / 联系人", required: true, placeholder: "王经理" },
    { name: "company", label: "公司", placeholder: "线索所在公司（可先不建档）" },
    { name: "phone", label: "电话" },
    { name: "email", label: "邮箱", type: "email" },
    { name: "source", label: "来源", type: "select", options: [{ value: "", label: "未选择" }, ...sourceOptions] },
    { name: "score", label: "评分 (0-100)", type: "number", defaultValue: "0" },
    { name: "note", label: "备注", type: "textarea", colSpan: 2 },
  ];

  const statusOptions = Object.entries(LEAD_STATUS).map(([value, label]) => ({ value, label }));
  const visibleLeads = leads.filter((l) => (selectedStatus === "ALL" || l.status === selectedStatus) && (!q || [l.name, l.company, l.email, l.phone, l.source].some((v) => String(v ?? "").toLowerCase().includes(q))));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="销售线索"
        desc={`共 ${leads.length} 条线索${[...pendingMap.values()].reduce((a, b) => a + b, 0) > 0 ? ` · 待审 AI 提案 ${[...pendingMap.values()].reduce((a, b) => a + b, 0)} 条` : ""} · nextcrm-app 独有模块（Comp AI 无直接对应），负责获客漏斗入口`}
        actions={
          <RecordModal
            slug={slug}
            title="新建线索"
            triggerText="新建线索"
            fields={fields}
            action={createLead.bind(null, slug)}
          />
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2"><form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="搜索线索、公司、邮箱" className="h-9 w-72 rounded-lg border border-slate-200 px-3 text-sm" />{selectedStatus !== "ALL" && <input type="hidden" name="status" value={selectedStatus} />}<button className="rounded-lg bg-slate-800 px-3 text-sm text-white">搜索</button></form>{[{ value: "ALL", label: "全部" }, ...statusOptions].map((s) => <Link key={s.value} href={`/w/${slug}/crm/leads?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(s.value !== "ALL" ? { status: s.value } : {}) })}`} className={`rounded-full px-3 py-1.5 text-xs ${selectedStatus === s.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{s.label}</Link>)}</div>
      {visibleLeads.length === 0 ? (
        <EmptyState icon={<Magnet className="size-10" />} title="还没有销售线索" desc="录入第一条线索，进入获客漏斗" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>线索</Th>
                  <Th>公司 / 来源</Th>
                  <Th>联系方式</Th>
                  <Th>评分</Th>
                  <Th>状态</Th>
                  <Th>AI 档案</Th>
                  <Th>创建</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <Td>
                      <p className="font-medium text-slate-900">{l.name}</p>
                      {l.note && <p className="max-w-40 truncate text-xs text-slate-400">{l.note}</p>}
                    </Td>
                    <Td className="text-[13px]">
                      {l.company ?? "—"}
                      {l.source && <span className="ml-1.5 text-xs text-slate-400">· {l.source}</span>}
                    </Td>
                    <Td>
                      <p className="text-[13px]">{l.phone ?? "—"}</p>
                      <p className="text-xs text-slate-400">{l.email ?? ""}</p>
                    </Td>
                    <Td>
                      <Badge tone={l.score >= 70 ? "green" : l.score >= 40 ? "amber" : "slate"}>{l.score}</Badge>
                    </Td>
                    <Td>
                      <QuickStatus current={l.status} options={statusOptions} action={updateLeadStatus.bind(null, slug, l.id)} />
                    </Td>
                    <Td>
                      <AiFactsButton
                        slug={slug}
                        entityType="LEAD"
                        entityId={l.id}
                        aiStatus={l.aiStatus}
                        pendingCount={pendingMap.get(l.id) ?? 0}
                      />
                    </Td>
                    <Td className="text-xs text-slate-400">{fmtDate(l.createdAt)}</Td>
                    <Td><div className="flex items-center gap-2"><RecordModal slug={slug} title="编辑销售线索" triggerText="编辑" fields={fields.map((f) => ({ ...f, defaultValue: String((l as Record<string, unknown>)[f.name] ?? "") }))} action={updateLead.bind(null, slug, l.id)} /><DeleteButton action={deleteLead.bind(null, slug, l.id)} /></div></Td>
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
