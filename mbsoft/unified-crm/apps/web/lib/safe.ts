import "server-only";

/**
 * 页面查询兜底 [P0 · 可观测性]
 * ----------------------------------------------------------------------------
 * 背景：生产曾出现「schema 少一张表 ⇒ Prisma client 缺对应 delegate ⇒ 页面抛
 * TypeError ⇒ 前端一直转圈」的情况。服务端组件里任何一次 await 抛错都会让整个
 * 页面挂掉，用户只看到无限加载，没有任何线索。
 *
 * 约定：页面级的批量查询统一走 safeQuery / safeQueryAll —— 查询失败时
 * 返回结构化错误，页面渲染 <QueryError> 明确告诉用户「哪一项查询失败、为什么」，
 * 而不是白屏或无限加载。
 */

export type SafeResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: string };

/** 把数据库/环境问题转成用户可读文案（保留原始消息，方便排查） */
function humanize(label: string, e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // PrismaClient 缺 delegate 时是 TypeError: Cannot read properties of undefined
  if (/is not a function|Cannot read propert|undefined/i.test(raw)) {
    return `${label}失败：数据模型未就绪（请确认已执行数据库同步 prisma db push / migrate）。原始错误：${raw}`;
  }
  if (/does not exist|no such table|relation .* does not exist/i.test(raw)) {
    return `${label}失败：数据表不存在（请执行数据库同步）。原始错误：${raw}`;
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(raw)) {
    return `${label}失败：数据库连接超时。原始错误：${raw}`;
  }
  return `${label}失败：${raw}`;
}

/** 单个查询兜底 */
export async function safeQuery<T>(label: string, fn: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, data: await fn(), error: null };
  } catch (e) {
    console.error(`[safeQuery] ${label}`, e);
    return { ok: false, data: null, error: humanize(label, e) };
  }
}

/**
 * 并行查询兜底：任一子项失败不影响其它子项。
 * 返回与输入同序的结果数组，页面可逐项判断 ok 后渲染。
 */
export async function safeQueryAll<T extends readonly unknown[]>(
  labels: readonly string[],
  fns: { [K in keyof T]: () => Promise<T[K]> },
): Promise<{ [K in keyof T]: SafeResult<T[K]> }> {
  const settled = await Promise.all(
    fns.map((fn, i) => safeQuery(labels[i] ?? `查询${i + 1}`, fn as () => Promise<unknown>)),
  );
  return settled as { [K in keyof T]: SafeResult<T[K]> };
}

/** 抛出为「未找到」的语义错误，供页面渲染 404 卡片 */
export class NotFoundError extends Error {
  constructor(message = "记录不存在或不属于当前组织") {
    super(message);
    this.name = "NotFoundError";
  }
}
