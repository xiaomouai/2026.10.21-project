import "server-only";
import { prisma } from "@ucrm/db";
import { loadOkrProgress } from "./okr";

/**
 * 企业详情聚合查询 [结构拆分 · 从 companies/page.tsx 与内联查询中抽出]
 * ----------------------------------------------------------------------------
 * 职责：一次把「企业详情页」需要的关联数据全部读出来（基本资料 / 联系人 /
 * 商机 / 跟进记录 / 下一步任务）。只负责查询与组装，不含鉴权与渲染。
 *
 * 租户隔离：所有查询必须带 orgId；查不到即视为不存在（不区分「不存在」与「越权」）。
 */

export type CompanyContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
  status: string;
};

export type CompanyOpportunity = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  stage: string;
  status: string;
  probability: number;
  expectedCloseAt: Date | null;
};

export type CompanyActivity = {
  id: string;
  type: string;
  subject: string;
  detail: string | null;
  status: string;
  sopStage: string | null;
  plannedAt: Date | null;
  dueAt: Date | null;
  happenedAt: Date;
  contactName: string | null;
  opportunityName: string | null;
};

export type CompanyDetail = {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  size: string | null;
  leadSource: string | null;
  note: string | null;
  ownerName: string | null;
  aiStatus: string;
  createdAt: Date;
  updatedAt: Date;
  contacts: CompanyContact[];
  opportunities: CompanyOpportunity[];
  activities: CompanyActivity[];
  /** 下一步任务：未完成的 TASK，按计划时间升序 */
  nextTasks: CompanyActivity[];
  counts: {
    contacts: number;
    opportunities: number;
    activities: number;
    openTasks: number;
    wonAmount: number;
    openAmount: number;
  };
};

/** 企业详情；不存在或不属于本组织时返回 null */
export async function loadCompanyDetail(
  orgId: string,
  companyId: string,
): Promise<CompanyDetail | null> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, orgId },
    include: { owner: { select: { name: true } } },
  });
  if (!company) return null;

  const [contacts, opportunities, activities] = await Promise.all([
    prisma.contact.findMany({
      where: { orgId, companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        phone: true,
        wechat: true,
        status: true,
      },
    }),
    prisma.opportunity.findMany({
      where: { orgId, companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        amount: true,
        currency: true,
        stage: true,
        status: true,
        probability: true,
        expectedCloseAt: true,
      },
    }),
    prisma.activity.findMany({
      where: { orgId, companyId },
      orderBy: { happenedAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        subject: true,
        detail: true,
        status: true,
        sopStage: true,
        plannedAt: true,
        dueAt: true,
        happenedAt: true,
        contact: { select: { name: true } },
        opportunity: { select: { name: true } },
      },
    }),
  ]);

  // Decimal → number，避免把 Prisma 类型泄漏到 UI 层
  const mappedOpportunities: CompanyOpportunity[] = opportunities.map((o) => ({
    ...o,
    amount: Number(o.amount),
  }));

  const mapped: CompanyActivity[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    detail: a.detail,
    status: a.status,
    sopStage: a.sopStage,
    plannedAt: a.plannedAt,
    dueAt: a.dueAt,
    happenedAt: a.happenedAt,
    contactName: a.contact?.name ?? null,
    opportunityName: a.opportunity?.name ?? null,
  }));

  const nextTasks = mapped
    .filter((a) => a.status === "OPEN" && (a.type === "TASK" || a.sopStage))
    .sort((a, b) => {
      const ta = (a.plannedAt ?? a.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const tb = (b.plannedAt ?? b.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

  const wonAmount = mappedOpportunities
    .filter((o) => o.status === "WON")
    .reduce((s, o) => s + o.amount, 0);
  const openAmount = mappedOpportunities
    .filter((o) => o.status === "OPEN")
    .reduce((s, o) => s + o.amount, 0);

  return {
    id: company.id,
    name: company.name,
    status: company.status,
    industry: company.industry,
    website: company.website,
    phone: company.phone,
    email: company.email,
    address: company.address,
    size: company.size,
    leadSource: company.leadSource,
    note: company.note,
    ownerName: company.owner?.name ?? null,
    aiStatus: company.aiStatus,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    contacts,
    opportunities: mappedOpportunities,
    activities: mapped,
    nextTasks,
    counts: {
      contacts: contacts.length,
      opportunities: opportunities.length,
      activities: activities.length,
      openTasks: nextTasks.length,
      wonAmount,
      openAmount,
    },
  };
}

/** 详情页顶部可选的 OKR 概览（失败不影响页面其它区块） */
export async function loadCompanyOkrSummary(orgId: string) {
  const rows = await loadOkrProgress(orgId);
  return rows[0] ?? null;
}

/** 企业列表（含关联计数与待办数），供列表页复用 */
export async function loadCompanyRows(orgId: string) {
  return prisma.company.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { contacts: true, opportunities: true } },
    },
  });
}
