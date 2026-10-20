// orders / payments 表读写：下单、支付流水与订单列表查询。

import { db } from '../db/client.js'

/**
 * 创建一条待支付订单。
 * @param {{orderNo: string, kind: string, tenantId: number|null, buyerId: number,
 *          productId: number|null, productName: string, amountCents: number,
 *          status: string, createdAt: number, refCode?: string|null}} row
 * @returns {number} 新订单 id
 */
export function insertOrder({
  orderNo,
  kind,
  tenantId,
  buyerId,
  productId,
  productName,
  amountCents,
  status,
  createdAt,
  refCode,
}) {
  const res = db()
    .prepare(
      `INSERT INTO orders
         (order_no, kind, tenant_id, buyer_id, product_id, product_name, amount_cents, status, created_at, ref_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(orderNo, kind, tenantId, buyerId, productId, productName, amountCents, status, createdAt, refCode || null)
  return Number(res.lastInsertRowid)
}

/**
 * 按订单号与买家取订单，用于支付前校验归属。
 * @param {string} orderNo
 * @param {number} buyerId
 * @returns {object|undefined}
 */
export const orderByNoAndBuyer = (orderNo, buyerId) =>
  db().prepare('SELECT * FROM orders WHERE order_no = ? AND buyer_id = ?').get(orderNo, buyerId)

/**
 * 按订单号取订单。
 * @param {string} orderNo
 * @returns {object|undefined}
 */
export const orderByNo = (orderNo) => db().prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo)

/**
 * 将订单标记为已支付并写入支付时间。
 * @param {number} orderId
 * @param {number} paidAt
 */
export function markPaid(orderId, paidAt) {
  db().prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(paidAt, orderId)
}

/**
 * 读者申报已付款：标记订单待店主确认（仅在 pending 状态生效）。
 * @param {number} orderId
 * @returns {number} 受影响行数
 */
export function markConfirmRequested(orderId) {
  const res = db()
    .prepare("UPDATE orders SET confirm_requested = 1 WHERE id = ? AND status = 'pending'")
    .run(orderId)
  return Number(res.changes)
}

/**
 * 按 id 取订单整行。
 * @param {number} id
 * @returns {object|undefined}
 */
export const orderById = (id) => db().prepare('SELECT * FROM orders WHERE id = ?').get(id)

/**
 * 写入一条支付流水。
 * @param {{paymentNo: string, orderId: number, channel: string, paidAt: number}} row
 */
export function insertPayment({ paymentNo, orderId, channel, paidAt }) {
  db()
    .prepare('INSERT INTO payments (payment_no, order_id, channel, paid_at) VALUES (?, ?, ?, ?)')
    .run(paymentNo, orderId, channel, paidAt)
}

/**
 * 查询买家的全部订单（含月租订单），按创建时间倒序。
 * @param {number} buyerId
 * @returns {object[]}
 */
export function ordersForUser(buyerId) {
  return db().prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC').all(buyerId)
}

/**
 * 查询店铺收到的商品订单，附带买家邮箱，按创建时间倒序。
 * @param {number} tenantId
 * @returns {object[]}
 */
export function ordersForTenant(tenantId) {
  return db()
    .prepare(
      `SELECT o.*, u.email buyer_email
         FROM orders o
         JOIN users u ON u.id = o.buyer_id
        WHERE o.tenant_id = ? AND o.kind = 'product'
        ORDER BY o.created_at DESC`,
    )
    .all(tenantId)
}

/**
 * 统计某商品的已支付订单数（销量）。
 * @param {number} productId
 * @returns {number}
 */
export function countPaidByProduct(productId) {
  return db().prepare("SELECT count(*) n FROM orders WHERE product_id = ? AND status = 'paid'").get(productId).n
}

/** 统计商品订单总数（不含月租订单） */
export const countProductOrders = () =>
  db().prepare("SELECT count(*) n FROM orders WHERE kind = 'product'").get().n

/** 统计已支付商品订单的总金额（分） */
export const sumPaidProductCents = () =>
  db().prepare("SELECT coalesce(sum(amount_cents), 0) n FROM orders WHERE kind = 'product' AND status = 'paid'").get().n

/**
 * 合伙人计划榜单：某店铺下，按推广码聚合已支付商品订单，
 * 返回每位推广者的带来读者数（去重买家）、销售金额与订单数，按销售金额倒序。
 * @param {number} tenantId 店铺 id
 * @param {number} fromTs 起始秒级时间戳（含），用于时段筛选
 * @returns {object[]} { code, referrer_email, buyers, sales_cents, orders_count }
 */
export function partnerLeaderboard(tenantId, fromTs) {
  return db()
    .prepare(
      `SELECT r.code,
              u.email referrer_email,
              count(DISTINCT o.buyer_id) buyers,
              coalesce(sum(o.amount_cents), 0) sales_cents,
              count(*) orders_count
         FROM orders o
         JOIN referrals r ON r.code = o.ref_code
         JOIN users u ON u.id = r.user_id
        WHERE o.tenant_id = ?
          AND o.kind = 'product'
          AND o.status = 'paid'
          AND o.ref_code IS NOT NULL
          AND o.buyer_id <> r.user_id
          AND o.paid_at >= ?
        GROUP BY r.code, u.email
        ORDER BY sales_cents DESC, buyers DESC`,
    )
    .all(tenantId, fromTs)
}
