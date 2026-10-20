// 领域层统一错误类型与断言工具。
// 业务规则校验全部抛 AppError，由调用方按 status 决定跳转到错误页还是继续向上抛。

/** 业务错误，message 文案对外可见（页面与测试依赖），status 用于区分 HTTP 语义 */
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

/** 条件不成立时抛 AppError，用于替代 if (!x) throw 的样板代码 */
export function assert(cond, message, status = 400) {
  if (!cond) throw new AppError(message, status)
}

/** 直接抛 AppError，用于在表达式中提前中断 */
export function fail(message, status = 400) {
  throw new AppError(message, status)
}

/** 判断 sqlite 抛出的异常是否为唯一约束冲突（注册邮箱重复、商品标识重复等） */
export function isUniqueError(err) {
  return String(err).includes('UNIQUE')
}
