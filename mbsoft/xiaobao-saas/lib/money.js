// 金额工具：数据库统一以「分」存储整数，展示层再转「元」。
// 所有涉及金额的计算都走这里，避免浮点误差在各页面重复出现。

/** 分转元数值，9900 -> 99 */
export const yuan = (cents) => Number(cents) / 100

/** 分转带货币符号的字符串，9900 -> '¥99.00' */
export const fmt = (cents) => '¥' + (Number(cents) / 100).toFixed(2)

/** 元转分并四舍五入，'88' -> 8800 */
export const toCents = (value) => Math.round(Number(value) * 100)
