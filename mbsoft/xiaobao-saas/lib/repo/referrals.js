// referrals 表读写：推广码与用户的归属关系，一个用户至多一个推广码。

import { db } from '../db/client.js'

/**
 * 按用户 id 查推广码记录。
 * @param {number} userId
 * @returns {object|undefined}
 */
export const referralByUserId = (userId) =>
  db().prepare('SELECT * FROM referrals WHERE user_id = ?').get(userId)

/**
 * 按推广码查记录，用于支付时反查推广者。
 * @param {string} code
 * @returns {object|undefined}
 */
export const referralByCode = (code) => db().prepare('SELECT * FROM referrals WHERE code = ?').get(code)

/**
 * 插入一条推广码记录。
 * @param {{code: string, userId: number, createdAt: number}} row
 */
export function insertReferral({ code, userId, createdAt }) {
  db().prepare('INSERT INTO referrals (code, user_id, created_at) VALUES (?, ?, ?)').run(code, userId, createdAt)
}
