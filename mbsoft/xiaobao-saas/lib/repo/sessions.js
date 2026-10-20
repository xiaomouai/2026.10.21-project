// sessions 表读写：会话落库、销毁，以及按 token 取「用户 + 店铺」信息。

import { db } from '../db/client.js'

/**
 * 写入一条会话记录。
 * @param {{tokenHash: string, userId: number, expiresAt: number}} row
 */
export function insertSession({ tokenHash, userId, expiresAt }) {
  db().prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt)
}

/**
 * 删除指定 token 的会话（退出登录）。
 * @param {string} tokenHash
 */
export const deleteSession = (tokenHash) => db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)

/**
 * 按 token 哈希取未过期的用户，并左连接其店铺信息。
 * @param {string} tokenHash
 * @param {number} nowTs 当前秒级时间戳
 * @returns {object|undefined}
 */
export function userWithTenantByTokenHash(tokenHash, nowTs) {
  return db()
    .prepare(
      `SELECT u.id, u.email, u.role,
              t.id tenant_id, t.name tenant_name, t.slug tenant_slug, t.period_end
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN tenants t ON t.owner_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, nowTs)
}
