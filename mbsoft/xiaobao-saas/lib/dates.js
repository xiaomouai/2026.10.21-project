// 时间工具：数据库统一以「秒级 unix 时间戳」存储，展示层再本地化。
// 常量与计算相关的部分见 lib/config.js。

/** 当前秒级 unix 时间戳 */
export const now = () => Math.floor(Date.now() / 1000)

/** 秒级时间戳转中文日期字符串，空值返回空串 */
export const fmtDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('zh-CN') : '')

/** 秒级时间戳转中文日期时间字符串，空值返回空串 */
export const fmtDateTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString('zh-CN') : '')
