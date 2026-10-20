// wallets 表读写：每个推广者一个余额账户。
// available_cents 为可提现余额，withdrawn_cents 为累计已提现金额。

import { db } from '../db/client.js'

/**
 * 取或创建用户钱包，返回当前余额。
 * @param {number} userId
 * @returns {{available_cents: number, withdrawn_cents: number}}
 */
export function getOrCreate(userId) {
  let row = db().prepare('SELECT available_cents, withdrawn_cents FROM wallets WHERE user_id = ?').get(userId)
  if (!row) {
    db().prepare('INSERT INTO wallets (user_id, available_cents, withdrawn_cents) VALUES (?, 0, 0)').run(userId)
    row = { available_cents: 0, withdrawn_cents: 0 }
  }
  return row
}

/**
 * 增加可提现余额（计佣时调用）。
 * @param {number} userId
 * @param {number} cents
 */
export function addAvailable(userId, cents) {
  getOrCreate(userId)
  db().prepare('UPDATE wallets SET available_cents = available_cents + ? WHERE user_id = ?').run(cents, userId)
}

/**
 * 提现时扣减可提现并累加已提现，须在事务中调用。
 * @param {number} userId
 * @param {number} amountCents 提现总额（税前）
 * @param {number} taxCents 税费
 */
export function settleWithdraw(userId, amountCents, taxCents) {
  db()
    .prepare('UPDATE wallets SET available_cents = available_cents - ?, withdrawn_cents = withdrawn_cents + ? WHERE user_id = ?')
    .run(amountCents, amountCents - taxCents, userId)
}
