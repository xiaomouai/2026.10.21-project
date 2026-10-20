import type { Metadata } from "next";
import { prisma } from "@ucrm/db";
import { requireUser } from "../../../../../lib/session";
import { requireOrg } from "../../../../../lib/org";
import { Card, PageHeader, Badge, Th, Td } from "../../../../../components/ui/primitives";
import { fmtDateTime } from "../../../../../lib/fmt";
import { Building2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "成员与组织" };
export const dynamic = "force-dynamic";

const roleTone: Record<string, "red" | "amber" | "blue" | "slate"> = {
  OWNER: "red",
  ADMIN: "amber",
  MEMBER: "blue",
  VIEWER: "slate",
};
const roleLabel: Record<string, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  MEMBER: "成员",
  VIEWER: "只读",
};

export default async function SettingsMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);

  const [orgDetail, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: org.id },
      select: { name: true, slug: true, plan: true, status: true, industry: true, size: true, trialEndsAt: true, createdAt: true },
    }),
    prisma.organizationMember.findMany({
      where: { orgId: org.id },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
  ]);
  if (!orgDetail) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader title="成员与组织" desc="SaaS 租户管理：一个组织即一个租户，业务数据相互隔离" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Building2 className="size-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{orgDetail.name}</h2>
              <p className="text-xs text-slate-400">slug: {orgDetail.slug}</p>
            </div>
          </div>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-slate-500">套餐</dt><dd><Badge tone="indigo">PLAN · {orgDetail.plan}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">状态</dt><dd><Badge tone={orgDetail.status === "TRIALING" ? "amber" : "green"}>{orgDetail.status}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">行业</dt><dd className="text-slate-800">{orgDetail.industry ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">规模</dt><dd className="text-slate-800">{orgDetail.size ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">试用截止</dt><dd className="text-slate-800">{orgDetail.trialEndsAt ? fmtDateTime(orgDetail.trialEndsAt) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">创建于</dt><dd className="text-slate-800">{fmtDateTime(orgDetail.createdAt)}</dd></div>
          </dl>
          <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
            邀请成员、套餐升级、SSO 随订阅与 ApiKey 模块迁移路线加入（见 docs/MIGRATION.md）
          </p>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">成员（{members.length}）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <Th>成员</Th>
                  <Th>角色</Th>
                  <Th>加入时间</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                          {m.user.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {m.user.name}
                            {m.user.id === user.id && <span className="ml-1.5 text-xs text-slate-400">（我）</span>}
                          </p>
                          <p className="text-xs text-slate-400">{m.user.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={roleTone[m.role] ?? "slate"}>{roleLabel[m.role] ?? m.role}</Badge>
                    </Td>
                    <Td className="text-xs text-slate-400">{fmtDateTime(m.joinedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
