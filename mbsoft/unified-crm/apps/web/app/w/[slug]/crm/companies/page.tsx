import type { Metadata } from "next";
import { prisma, COMPANY_STATUS } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { safeQuery } from "../../../../../lib/safe";
import { loadCompanyRows } from "../../../../../lib/crm/company-detail";
import { QueryError } from "../../../../../components/ui/query-error";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState, inputClass } from "../../../../../components/ui/primitives";
import { RecordModal, type FieldCfg } from "../../../../../components/crm/record-modal";
import { QuickStatus } from "../../../../../components/crm/quick-status";
import { createCompany, updateCompanyStatus } from "../../../../../lib/actions/crm";
import { updateCompany, deleteCompany } from "../../../../../lib/actions/crm";
import { DeleteButton } from "../../../../../components/crm/delete-button";
import Link from "next/link";
import { AiFactsButton } from "../../../../../components/ai/ai-facts-button";
import { fmtDate } from "../../../../../lib/fmt";
import { Building2 } from "lucide-react";

export const metadata: Metadata = { title: "企业客户" };
export const dynamic = "force-dynamic";

const fields: FieldCfg[] = [
  { name: "name", label: "客户名称", required: true, colSpan: 2, placeholder: "例如：杭州云帆贸易有限公司" },
  { name: "industry", label: "所属行业", placeholder: "例如：贸易 / 零售" },
  { name: "website", label: "官网", type: "url", placeholder: "https://…" },
  { name: "phone", label: "电话" },
  { name: "email", label: "邮箱", type: "email" },
  { name: "address", label: "地址" },
  { name: "note", label: "备注", type: "textarea", colSpan: 2 },
];

export default async function CompaniesPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; status?: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  const sp = await searchParams; const q = (sp.q ?? "").trim().toLowerCase(); const selectedStatus = sp.status ?? "ALL";

  const listResult = await safeQuery("企业客户查询", () => loadCompanyRows(org.id));

  // 每家客户的待审提案数（AI 建档徽章用）
  const proposedRows = await prisma.aiFact.findMany({
    where: { orgId: org.id, entityType: "COMPANY", status: "PROPOSED" },
    select: { entityId: true },
  });
  const pendingMap = new Map<string, number>();
  for (const r of proposedRows) pendingMap.set(r.entityId, (pendingMap.get(r.entityId) ?? 0) + 1);

  const statusOptions = Object.entries(COMPANY_STATUS).map(([value, label]) => ({ value, label }));

  // 查询失败：展示明确错误，不让页面一直转圈
  if (!listResult.ok) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <PageHeader title="企业客户" />
        <QueryError title="企业客户列表加载失败" error={listResult.error} />
      </div>
    );
  }

  const companies = listResult.data;
  const visibleCompanies = companies.filter((c) => (selectedStatus === "ALL" || c.status === selectedStatus) && (!q || [c.name, c.industry, c.email, c.phone].some((v) => String(v ?? "").toLowerCase().includes(q))));

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="企业客户"
        desc={`共 ${companies.length} 家客户 · 点击客户名称查看详情 · 来源：nextcrm-app crm_Accounts ≡ Comp AI Company`}
        actions={
          <RecordModal
            slug={slug}
            title="新建企业客户"
            desc="客户数据按组织隔离（orgId）"
            triggerText="新建客户"
            fields={fields}
            action={createCompany.bind(null, slug)}
          />
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2"><form className="flex gap-2"><input name="q" defaultValue={sp.q} placeholder="搜索客户名称、行业、邮箱" className="h-9 w-72 rounded-lg border border-slate-200 px-3 text-sm" />{selectedStatus !== "ALL" && <input type="hidden" name="status" value={selectedStatus} />}<button className="rounded-lg bg-slate-800 px-3 text-sm text-white">搜索</button></form>{[{ value: "ALL", label: "全部" }, ...statusOptions].map((s) => <Link key={s.value} href={`/w/${slug}/crm/companies?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(s.value !== "ALL" ? { status: s.value } : {}) })}`} className={`rounded-full px-3 py-1.5 text-xs ${selectedStatus === s.value ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>{s.label}</Link>)}</div>
      {visibleCompanies.length === 0 ? (
        <EmptyState icon={<Building2 className="size-10" />} title="还没有企业客户" desc="点击右上角「新建客户」录入第一家" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>客户</Th>
                  <Th>联系方式</Th>
                  <Th>联系人</Th>
                  <Th>商机</Th>
                  <Th>状态</Th>
                  <Th>AI 档案</Th>
                  <Th>创建</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {visibleCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Link
                        href={`/w/${slug}/crm/companies/${c.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-slate-400">{c.industry ?? "—"}</p>
                    </Td>
                    <Td>
                      <p className="text-[13px]">{c.phone ?? "—"}</p>
                      <p className="text-xs text-slate-400">{c.email ?? ""}</p>
                    </Td>
                    <Td className="text-center">{c._count.contacts}</Td>
                    <Td className="text-center">{c._count.opportunities}</Td>
                    <Td>
                      <QuickStatus
                        current={c.status}
                        options={statusOptions}
                        action={updateCompanyStatus.bind(null, slug, c.id)}
                      />
                    </Td>
                    <Td>
                      <AiFactsButton
                        slug={slug}
                        entityType="COMPANY"
                        entityId={c.id}
                        aiStatus={c.aiStatus}
                        pendingCount={pendingMap.get(c.id) ?? 0}
                      />
                    </Td>
                    <Td className="text-xs text-slate-400">{fmtDate(c.createdAt)}</Td>
                    <Td><div className="flex items-center gap-2"><Link href={`/w/${slug}/crm/companies/${c.id}`} className="text-xs text-indigo-600 hover:underline">详情</Link><RecordModal slug={slug} title="编辑企业客户" triggerText="编辑" fields={fields.map((f) => ({ ...f, defaultValue: String((c as Record<string, unknown>)[f.name] ?? "") }))} action={updateCompany.bind(null, slug, c.id)} /><DeleteButton action={deleteCompany.bind(null, slug, c.id)} /></div></Td>
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
