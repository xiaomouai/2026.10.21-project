import "server-only";
import { prisma } from "@ucrm/db";
import { redirect } from "next/navigation";

export type OrgCtx = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string; // OWNER / ADMIN / MEMBER / VIEWER
};

/** 按 slug 取组织并校验当前用户是成员；非成员/不存在则重定向 */
export async function requireOrg(slug: string, userId: string): Promise<OrgCtx> {
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { members: { where: { userId }, select: { role: true } } },
  });
  if (!org || org.members.length === 0) redirect("/onboarding");
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    role: org.members[0]!.role,
  };
}

/** 用户第一个组织（登录后跳转用） */
export async function firstOrgForUser(userId: string) {
  const m = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: { org: true },
  });
  return m?.org ?? null;
}
