import "server-only";

/**
 * 计划时间 / 截止时间约定 [站内提醒]
 * ----------------------------------------------------------------------------
 * Activity 上有两个时间字段，语义必须分清，否则提醒中心会算错：
 *
 *   plannedAt 计划时间 —— 打算什么时候去做这条跟进
 *   dueAt     截止时间 —— 最晚什么时候必须做完
 *
 * 提醒口径（见 lib/crm/reminders.ts）：
 *   到期提醒 = (plannedAt ?? dueAt) 落在未来 24 小时内
 *   逾期提醒 = (dueAt ?? plannedAt) 已早于当前时间
 *
 * 两者都允许为空（历史数据 / 随手登记的备注）；都为空时不进入提醒中心。
 */

const DAY_MS = 86_400_000;

/** 取「计划执行时间」：plannedAt 优先，回落 dueAt */
export function plannedTimeOf(a: { plannedAt?: Date | null; dueAt?: Date | null }): Date | null {
  return a.plannedAt ?? a.dueAt ?? null;
}

/** 取「截止时间」：dueAt 优先，回落 plannedAt */
export function dueTimeOf(a: { plannedAt?: Date | null; dueAt?: Date | null }): Date | null {
  return a.dueAt ?? a.plannedAt ?? null;
}

/**
 * 自动创建的 SOP 待办默认时间窗：
 *   计划执行 = 明天此刻，截止 = 计划执行 + 2 天
 * 给销售留出 2 天缓冲，避免刚建单就逾期。
 */
export function defaultTaskWindow(from = new Date()) {
  const plannedAt = new Date(from.getTime() + DAY_MS);
  const dueAt = new Date(plannedAt.getTime() + 2 * DAY_MS);
  return { plannedAt, dueAt };
}
