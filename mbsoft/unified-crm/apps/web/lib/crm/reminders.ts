import "server-only";
import { prisma } from "@ucrm/db";
import { plannedTimeOf, dueTimeOf } from "./schedule";
import { loadActiveOkrs } from "./okr";

/**
 * 站内提醒中心扫描引擎 [结构拆分 · 从 lib/ai/reminder.ts 与 dashboard 内联查询抽出]
 * ----------------------------------------------------------------------------
 * 与 AI 版提醒（走 AgentRun 审计）不同，本模块是**同步直读**的规则引擎：
 *   工作台一登录就要看到提醒，不能等用户点「运行扫描」。
 *
 * 铁律（沿用）：
 *   1. 一切查询带 orgId —— 跨租户不可见
 *   2. 只读 —— 只产出提醒列表，绝不改动任何业务主表
 *
 * 提醒口径：
 *   OVERDUE       逾期     —— 未完成跟进且已过截止时间
 *   DUE_SOON      即将到期 —— 计划时间落在未来 24 小时内
 *   NO_FOLLOWUP   7 天未跟进 —— 活跃客户最近一次跟进超过 7 天（或从未跟进）
 *   OPPORTUNITY   商机临期 —— 开放商机预计 7 天内成交
 *   OKR           OKR 缺口 —— 当前生效 OKR 的销售额 / 漏斗量缺口
 */

export type ReminderKind = "OVERDUE" | "DUE_SOON" | "NO_FOLLOWUP" | "OPPORTUNITY" | "OKR";

export type ReminderItem = {
  id: string;
  kind: ReminderKind;
  title: string;
  reason: string;
  priority: "high" | "medium";
  /** 触发时间（ISO），无时间依据时为 null */
  at: string | null;
  /** 站内跳转地址 */
  href: string;
  entityType: "ACTIVITY" | "COMPANY" | "OPPORTUNITY" | "OKR";
  entityId: string;
};

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  OVERDUE: "已逾期",
  DUE_SOON: "即将到期",
  NO_FOLLOWUP: "7 天未跟进",
  OPPORTUNITY: "商机临期",
  OKR: "OKR 缺口",
};

const DAY_MS = 86_400_000;
/** 7 天未跟进阈值 */
export const STALE_DAYS = 7;
/** 商机临期窗口（天） */
const OPP_NEAR_DAYS = 7;

export type ReminderScan = {
  items: ReminderItem[];
  counts: Record<ReminderKind, number>;
  scannedAt: string;
};

const emptyCounts = (): Record<ReminderKind, number> => ({
  OVERDUE: 0,
  DUE_SOON: 0,
  NO_FOLLOWUP: 0,
  OPPORTUNITY: 0,
  OKR: 0,
});

/** 扫描某组织的全部站内提醒（只读） */
export async function buildReminders(orgId: string, slug: string): Promise<ReminderScan> {
  const now = Date.now();
  const nowDate = new Date(now);
  const items: ReminderItem[] = [];
  const base = `/w/${slug}`;

  const [openActivities, companies, lastActs, openOpps] = await Promise.all([
    // A/B. 未完成的跟进（含计划时间与截止时间）
    prisma.activity.findMany({
      where: { orgId, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        type: true,
        subject: true,
        sopStage: true,
        plannedAt: true,
        dueAt: true,
        companyId: true,
        opportunityId: true,
        company: { select: { name: true } },
      },
    }),
    // C. 活跃客户（已流失的不催）
    prisma.company.findMany({
      where: { orgId, status: { not: "CHURNED" } },
      select: { id: true, name: true, createdAt: true },
      take: 500,
    }),
    // C. 每个客户最近一次跟进时间
    prisma.activity.groupBy({
      by: ["companyId"],
      where: { orgId, companyId: { not: null } },
      _max: { happenedAt: true },
    }),
    // D. 商机临期
    prisma.opportunity.findMany({
      where: {
        orgId,
        status: "OPEN",
        expectedCloseAt: { gte: nowDate, lte: new Date(now + OPP_NEAR_DAYS * DAY_MS) },
      },
      orderBy: { expectedCloseAt: "asc" },
      take: 20,
      select: {
        id: true,
        name: true,
        amount: true,
        currency: true,
        expectedCloseAt: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  // A. 逾期：截止时间已过
  for (const a of openActivities) {
    const due = dueTimeOf(a);
    const planned = plannedTimeOf(a);
    if (!due && !planned) continue; // 无时间依据 → 不进提醒中心
    const who = a.company?.name ? `（${a.company.name}）` : "";

    if (due && due.getTime() < now) {
      const days = Math.max(1, Math.ceil((now - due.getTime()) / DAY_MS));
      items.push({
        id: a.id,
        kind: "OVERDUE",
        title: a.subject,
        reason: `${who}已逾期 ${days} 天，请尽快处理`,
        priority: "high",
        at: due.toISOString(),
        href: `${base}/crm/activities`,
        entityType: "ACTIVITY",
        entityId: a.id,
      });
      continue;
    }

    // B. 即将到期：计划时间在未来 24 小时内
    if (planned && planned.getTime() >= now && planned.getTime() - now <= DAY_MS) {
      const hours = Math.max(0, Math.ceil((planned.getTime() - now) / 3_600_000));
      items.push({
        id: a.id,
        kind: "DUE_SOON",
        title: a.subject,
        reason: `${who}计划 ${hours} 小时后执行`,
        priority: "medium",
        at: planned.toISOString(),
        href: `${base}/crm/activities`,
        entityType: "ACTIVITY",
        entityId: a.id,
      });
    }
  }

  // C. 7 天未跟进客户
  const lastMap = new Map<string, Date>();
  for (const r of lastActs) {
    if (r.companyId && r._max.happenedAt) lastMap.set(r.companyId, r._max.happenedAt);
  }
  const staleCutoff = now - STALE_DAYS * DAY_MS;
  for (const c of companies) {
    const last = lastMap.get(c.id);
    const lastMs = last ? last.getTime() : c.createdAt.getTime();
    if (lastMs >= staleCutoff) continue;
    const days = Math.floor((now - lastMs) / DAY_MS);
    items.push({
      id: c.id,
      kind: "NO_FOLLOWUP",
      title: c.name,
      reason: last
        ? `已 ${days} 天没有跟进记录（${new Date(lastMs).toISOString().slice(0, 10)} 最后跟进）`
        : `建档 ${days} 天，从未登记跟进`,
      priority: days >= STALE_DAYS * 2 ? "high" : "medium",
      at: new Date(lastMs).toISOString(),
      href: `${base}/crm/companies/${c.id}`,
      entityType: "COMPANY",
      entityId: c.id,
    });
  }

  // D. 商机临期
  for (const o of openOpps) {
    const dueAt = o.expectedCloseAt ? new Date(o.expectedCloseAt).getTime() : now;
    const days = Math.max(0, Math.ceil((dueAt - now) / DAY_MS));
    const symbol = o.currency === "USD" ? "$" : "¥";
    items.push({
      id: o.id,
      kind: "OPPORTUNITY",
      title: o.name,
      reason: `预计 ${days} 天后成交（${o.company?.name ?? "—"} · ${symbol}${Number(o.amount).toLocaleString("zh-CN")}）`,
      priority: "high",
      at: o.expectedCloseAt ? new Date(o.expectedCloseAt).toISOString() : null,
      href: `${base}/crm/opportunities`,
      entityType: "OPPORTUNITY",
      entityId: o.id,
    });
  }

  // E. OKR 缺口
  const okrs = await loadActiveOkrs(orgId, nowDate);
  for (const okr of okrs) {
    const daysLeft = Math.max(1, Math.ceil((okr.endDate.getTime() - now) / DAY_MS));
    const [won, companies2, leads, opportunities] = await Promise.all([
      prisma.opportunity.findMany({
        where: { orgId, status: "WON", updatedAt: { gte: okr.startDate, lte: nowDate } },
        select: { amount: true },
      }),
      prisma.company.count({ where: { orgId, createdAt: { gte: okr.startDate, lte: nowDate } } }),
      prisma.lead.count({ where: { orgId, createdAt: { gte: okr.startDate, lte: nowDate } } }),
      prisma.opportunity.count({ where: { orgId, createdAt: { gte: okr.startDate, lte: nowDate } } }),
    ]);
    const amountGap = Math.max(0, Number(okr.targetAmount) - won.reduce((s, x) => s + Number(x.amount), 0));
    const gap = Math.max(0, okr.targetCompanies - companies2);
    const behind = amountGap > 0 || gap > 0 || leads < okr.targetLeads || opportunities < okr.targetOpportunities;
    if (!behind) continue;
    items.push({
      id: okr.id,
      kind: "OKR",
      title: okr.name,
      reason: `剩余 ${daysLeft} 天，仍需销售额 ¥${Math.ceil(amountGap / daysLeft).toLocaleString("zh-CN")} / 日，成交客户 ${Math.ceil(gap / daysLeft)} / 日；线索 ${leads}/${okr.targetLeads}，商机 ${opportunities}/${okr.targetOpportunities}`,
      priority: amountGap > 0 ? "high" : "medium",
      at: okr.endDate.toISOString(),
      href: `${base}/sales/okr`,
      entityType: "OKR",
      entityId: okr.id,
    });
  }

  // 排序：高优先在前 → 时间早的在前
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
    const ta = a.at ? new Date(a.at).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.at ? new Date(b.at).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });

  const counts = emptyCounts();
  for (const it of items) counts[it.kind] += 1;

  return { items, counts, scannedAt: new Date().toISOString() };
}
