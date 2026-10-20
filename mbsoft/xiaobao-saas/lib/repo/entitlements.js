// entitlements 表读写：买断/订阅权益的查询、写入与续期。

import { db } from '../db/client.js'

/**
 * 查询买家在某商品上的既有权益。
 * @param {number} buyerId
 * @param {number} productId
 * @returns {object|undefined}
 */
export const findByBuyerAndProduct = (buyerId, productId) =>
  db().prepare('SELECT expires_at FROM entitlements WHERE buyer_id = ? AND product_id = ?').get(buyerId, productId)

/**
 * 写入或更新权益；买断 expiresAt 传 null，订阅传新的到期时间。
 * @param {{buyerId: number, productId: number, sourceOrderId: number, expiresAt: number|null}} row
 */
export function upsert({ buyerId, productId, sourceOrderId, expiresAt }) {
  db()
    .prepare(
      `INSERT INTO entitlements (buyer_id, product_id, source_order_id, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (buyer_id, product_id)
       DO UPDATE SET source_order_id = excluded.source_order_id, expires_at = excluded.expires_at`,
    )
    .run(buyerId, productId, sourceOrderId, expiresAt)
}

/**
 * 查询买家未过期的权益，附带商品名与店铺名。
 * @param {number} buyerId
 * @param {number} nowTs 当前秒级时间戳
 * @returns {object[]}
 */
export function libraryFor(buyerId, nowTs) {
  return db()
    .prepare(
      `SELECT e.*, p.name, p.id product_id, t.name store_name
         FROM entitlements e
         JOIN products p ON p.id = e.product_id
         JOIN tenants t ON t.id = p.tenant_id
        WHERE e.buyer_id = ? AND (e.expires_at IS NULL OR e.expires_at > ?)`,
    )
    .all(buyerId, nowTs)
}

/**
 * 判断买家当前是否拥有某商品的阅读权。
 * @param {number} buyerId
 * @param {number} productId
 * @param {number} nowTs 当前秒级时间戳
 * @returns {boolean}
 */
export function hasAccess(buyerId, productId, nowTs) {
  return !!db()
    .prepare(
      `SELECT 1 FROM entitlements
        WHERE buyer_id = ? AND product_id = ? AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .get(buyerId, productId, nowTs)
}
