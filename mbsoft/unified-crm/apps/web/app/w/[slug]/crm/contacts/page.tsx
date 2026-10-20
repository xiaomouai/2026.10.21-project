import type { Metadata } from "next";
import { prisma } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { Card, PageHeader, Badge, statusTone, Th, Td, EmptyState } from "../../../../../components/ui/primitives";
import { RecordModal, type FieldCfg } from "../../../../../components/crm/record-modal";
import { createContact } from "../../../../../lib/actions/crm";
import { fmtDate } from "../../../../../lib/fmt";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "联系人" };
export const dynamic = "force-dynamic";

export default async function ContactsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    prisma.company.findMany({
      where: { orgId: org.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const companyOptions = [
    { value: "", label: "不关联企业" },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const fields: FieldCfg[] = [
    { name: "name", label: "姓名", required: true, placeholder: "张三" },
    { name: "title", label: "职务", placeholder: "采购总监" },
    { name: "companyId", label: "所属企业", type: "select", options: companyOptions },
    { name: "email", label: "邮箱", type: "email" },
    { name: "phone", label: "电话" },
    { name: "wechat", label: "微信" },
    { name: "note", label: "备注", type: "textarea", colSpan: 2 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="联系人"
        desc={`共 ${contacts.length} 位联系人 · 整合自两套源码的 Contact 语义`}
        actions={
          <RecordModal
            slug={slug}
            title="新建联系人"
            triggerText="新建联系人"
            fields={fields}
            action={createContact.bind(null, slug)}
          />
        }
      />
      {contacts.length === 0 ? (
        <EmptyState icon={<Users className="size-10" />} title="还没有联系人" desc="点击右上角新建，或先在企业客户下添加" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>姓名</Th>
                  <Th>所属企业</Th>
                  <Th>联系方式</Th>
                  <Th>职务 / 微信</Th>
                  <Th>状态</Th>
                  <Th>创建</Th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <Td>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.note && <p className="max-w-40 truncate text-xs text-slate-400">{c.note}</p>}
                    </Td>
                    <Td className="text-[13px]">{c.company?.name ?? "—"}</Td>
                    <Td>
                      <p className="text-[13px]">{c.phone ?? "—"}</p>
                      <p className="text-xs text-slate-400">{c.email ?? ""}</p>
                    </Td>
                    <Td className="text-[13px]">
                      {c.title ?? "—"}
                      {c.wechat && <span className="ml-2 text-xs text-emerald-600">微信:{c.wechat}</span>}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(c.status)}>{c.status === "ACTIVE" ? "正常" : "停用"}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-400">{fmtDate(c.createdAt)}</Td>
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
