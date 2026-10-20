import { notFound } from "next/navigation";
import { prisma } from "@ucrm/db";
import { requireUser } from "../../../lib/session";
import { requireOrg } from "../../../lib/org";
import { Sidebar } from "../../../components/app/sidebar";
import { UserMenu } from "../../../components/app/user-menu";
import { Badge } from "../../../components/ui/primitives";
import { ThemeToggle } from "../../../components/theme/theme-toggle";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  void org;

  const [orgDetail] = await Promise.all([
    prisma.organization.findUnique({ where: { id: org.id }, select: { name: true, slug: true, plan: true, status: true, trialEndsAt: true, industry: true, size: true } }),
  ]);
  if (!orgDetail) notFound();

  const trialDays = orgDetail.trialEndsAt
    ? Math.max(0, Math.ceil((orgDetail.trialEndsAt.getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar slug={slug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/90 px-6 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{orgDetail.name}</span>
            <Badge tone="indigo" className="!text-[10px]">PLAN · {orgDetail.plan}</Badge>
            {orgDetail.status === "TRIALING" && (
              <Badge tone="amber" className="!text-[10px]">试用剩 {trialDays} 天</Badge>
            )}
            <span className="ml-2 hidden truncate text-xs text-slate-400 md:inline">
              数据隔离按组织 · slug: {orgDetail.slug}
            </span>
          </div>
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} orgName={orgDetail.name} />
        </header>
        <main className="flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
