import "server-only";
import { prisma } from "@ucrm/db";

/**
 * 销售 OKR 进度计算 [结构拆分 · 从 okr/page.tsx 抽出]
 * ----------------------------------------------------------------------------
 * 职责：只负责「按组织读 OKR + 统计实际进度」，不做鉴权、不做渲染。
 * 调用方一律用 safeQuery 包一层，查询失败时页面渲染明确错误。
 */

const DAY_MS = 86_400_000;

export type OkrPeriodStat = {
  period: string;
  amount: number;
  companies: number;
  leads: number;
  opportunities: number;
};

export type OkrProgressRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  targetAmount: number;
  targetCompanies: number;
  targetLeads: number;
  targetOpportunities: number;
  actual: {
    amount: number;
    companies: number;
    leads: number;
    opportunities: number;
  };
  stats: OkrPeriodStat[];
};

/**
 * 读取某组织全部 ACTIVE OKR 的实际进度。
 * 注意：必须带 orgId —— 跨租户不可见。
 */
export async function loadOkrProgress(orgId: string): Promise<OkrProgressRow[]> {
  const okrs = await prisma.salesOkr.findMany({
    where: { orgId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (okrs.length === 0) return [];

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const periods: [string, Date][] = [
    ["今日", new Date(now.getFullYear(), now.getMonth(), now.getDate())],
    ["本周", startOfWeek],
    ["本月", startOfMonth],
  ];

  return Promise.all(
    okrs.map(async (okr) => {
      // 结束日按「当天 23:59:59.999」计入，避免 endDate 当天的数据被漏掉
      const range = { gte: okr.startDate, lte: new Date(okr.endDate.getTime() + DAY_MS - 1) };

      const [companies, leads, opportunities, won, companyRows, leadRows, opportunityRows, wonRows] =
        await Promise.all([
          prisma.company.count({ where: { orgId, createdAt: range } }),
          prisma.lead.count({ where: { orgId, createdAt: range } }),
          prisma.opportunity.count({ where: { orgId, createdAt: range } }),
          prisma.opportunity.findMany({
            where: { orgId, status: "WON", updatedAt: range },
            select: { amount: true },
          }),
          prisma.company.findMany({ where: { orgId, createdAt: range }, select: { createdAt: true } }),
          prisma.lead.findMany({ where: { orgId, createdAt: range }, select: { createdAt: true } }),
          prisma.opportunity.findMany({
            where: { orgId, createdAt: range },
            select: { createdAt: true },
          }),
          prisma.opportunity.findMany({
            where: { orgId, status: "WON", updatedAt: range },
            select: { updatedAt: true, amount: true },
          }),
        ]);

      const stats: OkrPeriodStat[] = periods.map(([period, from]) => {
        const inRange = (date: Date) => date >= from && date <= okr.endDate;
        return {
          period,
          amount: wonRows
            .filter((x) => inRange(x.updatedAt))
            .reduce((s, x) => s + Number(x.amount), 0),
          companies: companyRows.filter((x) => inRange(x.createdAt)).length,
          leads: leadRows.filter((x) => inRange(x.createdAt)).length,
          opportunities: opportunityRows.filter((x) => inRange(x.createdAt)).length,
        };
      });

      return {
        id: okr.id,
        name: okr.name,
        startDate: okr.startDate,
        endDate: okr.endDate,
        targetAmount: Number(okr.targetAmount),
        targetCompanies: okr.targetCompanies,
        targetLeads: okr.targetLeads,
        targetOpportunities: okr.targetOpportunities,
        actual: {
          amount: won.reduce((s, x) => s + Number(x.amount), 0),
          companies,
          leads,
          opportunities,
        },
        stats,
      };
    }),
  );
}

/** 当前生效（时间窗覆盖今天）的 OKR，供提醒中心使用 */
export async function loadActiveOkrs(orgId: string, now = new Date()) {
  return prisma.salesOkr.findMany({
    where: { orgId, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { endDate: "asc" },
  });
}
