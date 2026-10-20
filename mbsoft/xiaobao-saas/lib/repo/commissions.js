// commissions 表读写：推广佣金流水，order_id 唯一保证每笔订单至多计佣一次。

import { db } from '../db/client.js'

/**
 * 插入一条佣金记录；INSERT OR IGNORE 保证 pay 幂等重放不重复计佣。
 * @param {{orderId: number, referrerId: number, amountCents: number, createdAt: number}} row
 */
export function insertCommission({ orderId, referrerId, amountCents, createdAt }) {
  db()
    .prepare(
      "INSERT OR IGNORE INTO commissions (order_id, referrer_id, amount_cents, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    )
    .run(orderId, referrerId, amountCents, createdAt)
}

/**
 * 查询推广者的佣金明细，JOIN 订单取订单号/商品名/订单金额，按时间倒序。
 * @param {number} userId 推广者 id
 * @returns {object[]}
 */
export function commissionsForReferrer(userId) {
  return db()
    .prepare(
      `SELECT c.id, c.amount_cents, c.status, c.created_at,
              o.order_no, o.product_name, o.amount_cents order_amount_cents
         FROM commissions c
         JOIN orders o ON o.id = c.order_id
        WHERE c.referrer_id = ?
        ORDER BY c.created_at DESC`,
    )
    .all(userId)
}

/**
 * 统计推广者累计佣金（分）。
 * @param {number} userId
 * @returns {number}
 */
export const commissionSum = (userId) =>
  db().prepare('SELECT coalesce(sum(amount_cents), 0) n FROM commissions WHERE referrer_id = ?').get(userId).n

/**
 * 统计推广者「待结算」佣金（分），即可提现部分。
 * @param {number} userId
 * @returns {number}
 */
export const commissionPendingSum = (userId) =>
  db()
    .prepare("SELECT coalesce(sum(amount_cents), 0) n FROM commissions WHERE referrer_id = ? AND status = 'pending'")
    .get(userId).n

/**
 * 查询推广者的待结算佣金明细。
 * @param {number} userId
 * @returns {object[]}
 */
export const pendingForReferrer = (userId) =>
  db()
    .prepare("SELECT * FROM commissions WHERE referrer_id = ? AND status = 'pending' ORDER BY created_at DESC")
    .all(userId)

/**
 * 将推广者的全部待结算佣金标记为已结算（提现时调用，须在事务中）。
 * @param {number} userId
 */
export function markSettledForUser(userId) {
  db().prepare("UPDATE commissions SET status = 'settled' WHERE referrer_id = ? AND status = 'pending'").run(userId)
}
