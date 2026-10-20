import { prisma } from "@ucrm/db";

/**
 * 跟进提醒 Agent · 扫描引擎 [AI·NEW · P2-2]
 *
 * 与 P0/P1 同一条铁律：
 *   1. 一切查询带 orgId —— 跨租户不可见
 *   2. 只读扫描 —— 只产出「提醒」列表，绝不改动任何业务主表
 *   3. 提醒落 AgentRun 审计（agentName=followup-reminder），dashboard / dev 看板可溯源
 *
 * 数据来源（受 Activity 无 dueDate 字段约束，务实口径）：
 *   A. 商机临期：Opportunity.status=OPEN 且 expectedCloseAt ∈ [now, +7d] → 高优先
 *   B. 待办未完成：Activity.status=OPEN 且 type=TASK → 待办提醒
 */

export type Reminder = {
  id: string;
  entityType: "OPPORTUNITY" | "ACTIVITY" | "OKR";
  entityId: string;
  title: string;
  reason: string;
  priority: "high" | "medium";
  dueAt: string | null;
  amount?: number;
};

export type ReminderOutcome = {
  ok: boolean;
  message?: string;
  error?: string;
  /** 复用调度器 output 字段：= reminderCount，便于 dispatchOnce 统一落库 */
  factCount: number;
  runId: string;
  mode: "rule";
  reminders: Reminder[];
};

const NEAR_MS = 7 * 24 * 3600 * 1000;

export async function runReminderScan(o: {
  orgId: string;
  taskId?: string | null;
}): Promise<ReminderOutcome> {
  const { orgId, taskId = null } = o;
  const now = Date.now();
  const horizon = new Date(now + NEAR_MS);
  const startedAt = Date.now();

  const run = await prisma.agentRun.create({
    data: {
      orgId,
      taskId,
      agentName: "followup-reminder",
      source: "schedule",
      idempotencyKey: `reminder:scan:${orgId}:${Date.now()}`,
      status: "STARTED",
    },
  });

  try {
    const reminders: Reminder[] = [];

    // A. 商机临期
    const dueOpps = await prisma.opportunity.findMany({
      where: { orgId, status: "OPEN", expectedCloseAt: { gte: new Date(now), lte: horizon } },
      orderBy: { expectedCloseAt: "asc" },
      take: 12,
      select: {
        id: true,
        name: true,
        amount: true,
        currency: true,
        expectedCloseAt: true,
        company: { select: { name: true } },
      },
    });
    for (const o of dueOpps) {
      const dueAt = o.expectedCloseAt ? new Date(o.expectedCloseAt).getTime() : now;
      const days = Math.max(0, Math.ceil((dueAt - now) / 86_400_000));
      reminders.push({
        id: o.id,
        entityType: "OPPORTUNITY",
        entityId: o.id,
        title: o.name,
        reason: `预计 ${days} 天后成交（${o.company?.name ?? "—"} · ¥${Number(o.amount).toLocaleString("zh-CN")}）`,
        priority: "high",
        dueAt: o.expectedCloseAt ? new Date(o.expectedCloseAt).toISOString() : null,
        amount: Number(o.amount),
      });
    }

    // B. 未完成的 TASK 类待办
    const tasks = await prisma.activity.findMany({
      where: { orgId, status: "OPEN", type: "TASK" },
      orderBy: { createdAt: "asc" },
      take: 12,
      select: {
        id: true,
        subject: true,
        opportunityId: true,
        company: { select: { name: true } },
      },
    });
    for (const a of tasks) {
      const tag = a.opportunityId ? "关联商机待办" : "待办任务";
      const who = a.company?.name ? `（${a.company.name}）` : "";
      reminders.push({
        id: a.id,
        entityType: "ACTIVITY",
        entityId: a.id,
        title: a.subject,
        reason: `${tag}${who}尚未完成`,
        priority: "medium",
        dueAt: null,
      });
    }

    // C. 销售 OKR 日目标：按剩余天数计算今日仍需补齐的金额与漏斗量
    const okrs = await prisma.salesOkr.findMany({ where: { orgId, status: "ACTIVE", startDate: { lte: new Date() }, endDate: { gte: new Date() } } });
    for (const okr of okrs) {
      const daysLeft = Math.max(1, Math.ceil((okr.endDate.getTime() - now) / 86_400_000));
      const [won, companies, leads, opportunities] = await Promise.all([
        prisma.opportunity.findMany({ where: { orgId, status: "WON", updatedAt: { gte: okr.startDate, lte: new Date(now) } }, select: { amount: true } }),
        prisma.company.count({ where: { orgId, createdAt: { gte: okr.startDate, lte: new Date(now) } } }),
        prisma.lead.count({ where: { orgId, createdAt: { gte: okr.startDate, lte: new Date(now) } } }),
        prisma.opportunity.count({ where: { orgId, createdAt: { gte: okr.startDate, lte: new Date(now) } } }),
      ]);
      const amountGap = Math.max(0, Number(okr.targetAmount) - won.reduce((s, x) => s + Number(x.amount), 0));
      const gap = Math.max(0, Number(okr.targetCompanies) - companies);
      if (amountGap > 0 || gap > 0 || leads < okr.targetLeads || opportunities < okr.targetOpportunities) reminders.push({ id: okr.id, entityType: "OKR", entityId: okr.id, title: okr.name, reason: `剩余 ${daysLeft} 天，仍需销售额 ¥${Math.ceil(amountGap / daysLeft).toLocaleString("zh-CN")} / 日，成交客户 ${Math.ceil(gap / daysLeft)} / 日；线索 ${leads}/${okr.targetLeads}，商机 ${opportunities}/${okr.targetOpportunities}`, priority: amountGap > 0 ? "high" : "medium", dueAt: okr.endDate.toISOString() });
    }

    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
        result: { mode: "rule", provider: "rules-engine", reminderCount: reminders.length, reminders } as never,
      },
    });
    await prisma.agentRunEvent.create({
      data: {
        runId: run.id,
        type: "milestone",
        name: "scan-complete",
        payload: { reminderCount: reminders.length } as never,
      },
    });

    return {
      ok: true,
      message: `扫描完成，发现 ${reminders.length} 条跟进提醒`,
      factCount: reminders.length,
      runId: run.id,
      mode: "rule",
      reminders,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: msg, finishedAt: new Date(), durationMs: Date.now() - startedAt },
    });
    return { ok: false, error: msg, factCount: 0, runId: run.id, mode: "rule", reminders: [] };
  }
}
