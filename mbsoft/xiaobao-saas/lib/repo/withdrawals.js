// withdrawals 表读写：推广者的提现记录，每笔按 6.1% 计提税费。

import { db } from '../db/client.js'

/**
 * 写入一条提现记录（模拟环境即时打款）。
 * @param {{userId: number, amountCents: number, taxCents: number, netCents: number, createdAt: number}} row
 * @returns {number} 新记录 id
 */
export function insert({ userId, amountCents, taxCents, netCents, createdAt }) {
  const res = db()
    .prepare(
      "INSERT INTO withdrawals (user_id, amount_cents, tax_cents, net_cents, status, created_at) VALUES (?, ?, ?, ?, 'paid', ?)",
    )
    .run(userId, amountCents, taxCents, netCents, createdAt)
  return Number(res.lastInsertRowid)
}

/**
 * 查询推广者的提现记录，按时间倒序。
 * @param {number} userId
 * @returns {object[]}
 */
export const listForUser = (userId) =>
  db().prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC').all(userId)
