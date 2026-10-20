"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@ucrm/db";
import { requireUser } from "../session";
import { requireOrg } from "../org";
import { firstSopTask, planNextSopTask } from "../crm/sop";
import { defaultTaskWindow } from "../crm/schedule";

export type ActState = { ok: boolean; error?: string };

/** 解析当前用户 + 校验对某组织的成员资格，返回组织上下文 */
async function withOrg(slug: string) {
  const user = await requireUser();
  const org = await requireOrg(slug, user.id);
  return { user, org };
}

const path = (slug: string, seg: string) => `/w/${slug}${seg}`;
const str = (fd: FormData, k: string) => String(fd.get(k) || "").trim() || null;
const dateOr = (fd: FormData, k: string): Date | null => {
  const v = String(fd.get(k) || "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/* ------------------------------------------------------------------ */
/* Company 企业客户                                                     */
/* ------------------------------------------------------------------ */

export async function createCompany(slug: string, fd: FormData): Promise<ActState> {
  const { user, org } = await withOrg(slug);
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "请填写客户名称" };
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        orgId: org.id,
        ownerUserId: user.id,
        name,
        industry: str(fd, "industry"),
        website: str(fd, "website"),
        phone: str(fd, "phone"),
        email: str(fd, "email"),
        address: str(fd, "address"),
        note: str(fd, "note"),
        status: (str(fd, "status") as never) || "ACTIVE",
      },
    });
    // 建档即进入 SOP：自动产生「首次联系」待办（验收项）
    const first = firstSopTask();
    const win = defaultTaskWindow();
    await tx.activity.create({
      data: {
        orgId: org.id,
        companyId: company.id,
        ownerUserId: user.id,
        type: "TASK",
        subject: first.subject,
        sopStage: first.stage,
        plannedAt: win.plannedAt,
        dueAt: win.dueAt,
      },
    });
  });
  revalidatePath(path(slug, "/crm/companies"));
  return { ok: true };
}

export async function updateCompanyStatus(slug: string, id: string, status: string): Promise<ActState> {
  const { org } = await withOrg(slug);
  await prisma.company.updateMany({ where: { id, orgId: org.id }, data: { status } });
  revalidatePath(path(slug, "/crm/companies"));
  return { ok: true };
}
export async function updateCompany(slug: string, id: string, fd: FormData): Promise<ActState> {
  const { org } = await withOrg(slug); const name = str(fd, "name");
  if (!name) return { ok: false, error: "请填写客户名称" };
  await prisma.company.updateMany({ where: { id, orgId: org.id }, data: { name, industry: str(fd, "industry"), website: str(fd, "website"), phone: str(fd, "phone"), email: str(fd, "email"), address: str(fd, "address"), note: str(fd, "note") } });
  revalidatePath(path(slug, "/crm/companies")); return { ok: true };
}
export async function deleteCompany(slug: string, id: string): Promise<ActState> { const { org } = await withOrg(slug); await prisma.company.deleteMany({ where: { id, orgId: org.id } }); revalidatePath(path(slug, "/crm/companies")); return { ok: true }; }

/* ------------------------------------------------------------------ */
/* Contact 联系人                                                       */
/* ------------------------------------------------------------------ */

export async function createContact(slug: string, fd: FormData): Promise<ActState> {
  const { org } = await withOrg(slug);
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "请填写联系人姓名" };
  await prisma.contact.create({
    data: {
      orgId: org.id,
      name,
      companyId: str(fd, "companyId"),
      title: str(fd, "title"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      wechat: str(fd, "wechat"),
      note: str(fd, "note"),
    },
  });
  revalidatePath(path(slug, "/crm/contacts"));
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Lead 销售线索                                                        */
/* ------------------------------------------------------------------ */

export async function createLead(slug: string, fd: FormData): Promise<ActState> {
  const { org } = await withOrg(slug);
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "请填写线索名称" };
  await prisma.lead.create({
    data: {
      orgId: org.id,
      name,
      company: str(fd, "company"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      source: str(fd, "source"),
      score: Number(str(fd, "score") || 0),
      note: str(fd, "note"),
    },
  });
  revalidatePath(path(slug, "/crm/leads"));
  return { ok: true };
}

export async function updateLeadStatus(slug: string, id: string, status: string): Promise<ActState> {
  const { org } = await withOrg(slug);
  const data: Record<string, unknown> = { status };
  if (status === "CONVERTED") data.convertedAt = new Date();
  await prisma.lead.updateMany({ where: { id, orgId: org.id }, data });
  revalidatePath(path(slug, "/crm/leads"));
  return { ok: true };
}
export async function updateLead(slug: string, id: string, fd: FormData): Promise<ActState> { const { org } = await withOrg(slug); const name = str(fd, "name"); if (!name) return { ok: false, error: "请填写线索名称" }; await prisma.lead.updateMany({ where: { id, orgId: org.id }, data: { name, company: str(fd, "company"), email: str(fd, "email"), phone: str(fd, "phone"), source: str(fd, "source"), score: Number(str(fd, "score") || 0), note: str(fd, "note") } }); revalidatePath(path(slug, "/crm/leads")); return { ok: true }; }
export async function deleteLead(slug: string, id: string): Promise<ActState> { const { org } = await withOrg(slug); await prisma.lead.deleteMany({ where: { id, orgId: org.id } }); revalidatePath(path(slug, "/crm/leads")); return { ok: true }; }

/* ------------------------------------------------------------------ */
/* Opportunity 商机                                                     */
/* ------------------------------------------------------------------ */

export async function createOpportunity(slug: string, fd: FormData): Promise<ActState> {
  const { org } = await withOrg(slug);
  const name = str(fd, "name");
  if (!name) return { ok: false, error: "请填写商机名称" };
  const stage = (str(fd, "stage") as string) || "QUALIFICATION";
  const status = stage === "WON" || stage === "LOST" ? stage : "OPEN";
  await prisma.opportunity.create({
    data: {
      orgId: org.id,
      name,
      companyId: str(fd, "companyId"),
      contactId: str(fd, "contactId"),
      amount: Number(str(fd, "amount") || 0),
      stage,
      status,
      probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : Number(str(fd, "probability") || 10),
      expectedCloseAt: dateOr(fd, "expectedCloseAt"),
      note: str(fd, "note"),
    },
  });
  revalidatePath(path(slug, "/crm/opportunities"));
  return { ok: true };
}

export async function updateOpportunityStage(slug: string, id: string, stage: string): Promise<ActState> {
  const { org } = await withOrg(slug);
  const status = stage === "WON" || stage === "LOST" ? stage : "OPEN";
  const probability =
    stage === "WON" ? 100 : stage === "LOST" ? 0 : undefined;
  await prisma.opportunity.updateMany({
    where: { id, orgId: org.id },
    data: { stage, status, ...(probability !== undefined ? { probability } : {}) },
  });
  revalidatePath(path(slug, "/crm/opportunities"));
  return { ok: true };
}
export async function updateOpportunity(slug: string, id: string, fd: FormData): Promise<ActState> { const { org } = await withOrg(slug); const name = str(fd, "name"); if (!name) return { ok: false, error: "请填写商机名称" }; const stage = (str(fd, "stage") as string) || "QUALIFICATION"; await prisma.opportunity.updateMany({ where: { id, orgId: org.id }, data: { name, companyId: str(fd, "companyId"), contactId: str(fd, "contactId"), amount: Number(str(fd, "amount") || 0), stage, status: stage === "WON" || stage === "LOST" ? stage : "OPEN", probability: stage === "WON" ? 100 : stage === "LOST" ? 0 : Number(str(fd, "probability") || 10), expectedCloseAt: dateOr(fd, "expectedCloseAt"), note: str(fd, "note") } }); revalidatePath(path(slug, "/crm/opportunities")); return { ok: true }; }
export async function deleteOpportunity(slug: string, id: string): Promise<ActState> { const { org } = await withOrg(slug); await prisma.opportunity.deleteMany({ where: { id, orgId: org.id } }); revalidatePath(path(slug, "/crm/opportunities")); return { ok: true }; }

/* ------------------------------------------------------------------ */
/* Activity 跟进活动                                                    */
/* ------------------------------------------------------------------ */

export async function createActivity(slug: string, fd: FormData): Promise<ActState> {
  const { user, org } = await withOrg(slug);
  const subject = str(fd, "subject");
  if (!subject) return { ok: false, error: "请填写跟进主题" };
  await prisma.activity.create({
    data: {
      orgId: org.id,
      type: (str(fd, "type") as string) || "NOTE",
      subject,
      detail: str(fd, "detail"),
      companyId: str(fd, "companyId"),
      contactId: str(fd, "contactId"),
      opportunityId: str(fd, "opportunityId"),
      ownerUserId: user.id,
      plannedAt: dateOr(fd, "plannedAt"),
      dueAt: dateOr(fd, "dueAt"),
      happenedAt: dateOr(fd, "happenedAt") ?? new Date(),
    },
  });
  revalidatePath(path(slug, "/crm/activities"));
  return { ok: true };
}

/**
 * 完成 / 重开一条待办。
 * 标记为 DONE 时：若该待办属于 SOP 流程，自动创建下一阶段待办；
 * 关联商机已 WON / LOST 或客户已 CHURNED 时停止推进（见 lib/crm/sop.ts）。
 */
export async function setActivityStatus(slug: string, id: string, status: string): Promise<ActState> {
  const { user, org } = await withOrg(slug);
  const nextStatus = status === "DONE" ? "DONE" : "OPEN";
  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findFirst({
      where: { id, orgId: org.id },
      select: {
        id: true,
        sopStage: true,
        companyId: true,
        contactId: true,
        opportunityId: true,
        ownerUserId: true,
      },
    });
    if (!activity) return;

    const updated = await tx.activity.updateMany({
      where: { id, orgId: org.id, status: { not: nextStatus } },
      data: { status: nextStatus },
    });
    if (updated.count !== 1 || nextStatus !== "DONE") return;

    // 成交 / 流失判定：读关联商机与客户的最新状态
    let opportunityStatus: string | null = null;
    let opportunityStage: string | null = null;
    if (activity.opportunityId) {
      const opp = await tx.opportunity.findFirst({
        where: { id: activity.opportunityId, orgId: org.id },
        select: { status: true, stage: true },
      });
      opportunityStatus = opp?.status ?? null;
      opportunityStage = opp?.stage ?? null;
    }
    let companyStatus: string | null = null;
    if (activity.companyId) {
      const c = await tx.company.findFirst({
        where: { id: activity.companyId, orgId: org.id },
        select: { status: true },
      });
      companyStatus = c?.status ?? null;
    }

    const next = planNextSopTask({
      stage: activity.sopStage,
      opportunityStatus,
      opportunityStage,
      companyStatus,
    });
    if (!next) return;

    const win = defaultTaskWindow();
    await tx.activity.create({
      data: {
        orgId: org.id,
        companyId: activity.companyId,
        contactId: activity.contactId,
        opportunityId: activity.opportunityId,
        ownerUserId: activity.ownerUserId ?? user.id,
        type: "TASK",
        subject: next.subject,
        sopStage: next.stage,
        plannedAt: win.plannedAt,
        dueAt: win.dueAt,
      },
    });
  });
  revalidatePath(path(slug, "/crm/activities"));
  // 详情页也展示下一步任务，一并刷新
  revalidatePath(path(slug, "/crm/companies"), "layout");
  return { ok: true };
}

export async function createSalesOkr(slug: string, fd: FormData): Promise<ActState> {
  const { user, org } = await withOrg(slug);
  const name = str(fd, "name");
  const startDate = dateOr(fd, "startDate");
  const endDate = dateOr(fd, "endDate");
  if (!name) return { ok: false, error: "请填写 OKR 名称" };
  if (!startDate || !endDate || endDate < startDate) return { ok: false, error: "请填写有效的 OKR 日期范围" };
  const amount = Number(str(fd, "targetAmount") || 0);
  const ticket = Math.max(1, Number(str(fd, "averageDealAmount") || 1));
  const leadRate = Math.min(100, Math.max(1, Number(str(fd, "leadToOpportunityRate") || 20)));
  const wonRate = Math.min(100, Math.max(1, Number(str(fd, "opportunityToWonRate") || 25)));
  const customers = Math.max(0, Number(str(fd, "targetCompanies") || 0) || Math.ceil(amount / ticket));
  const opportunities = Math.max(0, Number(str(fd, "targetOpportunities") || 0) || Math.ceil(customers / (wonRate / 100)));
  const leads = Math.max(0, Number(str(fd, "targetLeads") || 0) || Math.ceil(opportunities / (leadRate / 100)));
  await prisma.salesOkr.create({
    data: {
      orgId: org.id, createdById: user.id, name,
      targetAmount: amount, averageDealAmount: ticket, leadToOpportunityRate: leadRate, opportunityToWonRate: wonRate,
      targetCompanies: customers, targetLeads: leads, targetOpportunities: opportunities,
      startDate, endDate,
    },
  });
  revalidatePath(path(slug, "/sales/okr"));
  return { ok: true };
}
