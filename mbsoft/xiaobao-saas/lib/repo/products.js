// products 表读写：商品查询、创建，以及发现页需要的聚合。

import { db } from '../db/client.js'

/**
 * 创建商品。
 * @param {{tenantId: number, name: string, slug: string, description: string,
 *          audience: string, priceCents: number, mode: string, status: string}} row
 * @returns {number} 新商品 id
 */
export function insertProduct({ tenantId, name, slug, description, audience, priceCents, mode, status }) {
  const res = db()
    .prepare(
      `INSERT INTO products (tenant_id, name, slug, description, audience, price_cents, mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(tenantId, name, slug, description, audience, priceCents, mode, status)
  return Number(res.lastInsertRowid)
}

/**
 * 按 id 查商品整行。
 * @param {number} id
 * @returns {object|undefined}
 */
export const productById = (id) => db().prepare('SELECT * FROM products WHERE id = ?').get(id)

/**
 * 按店铺 id + slug 查商品整行。
 * @param {number} tenantId
 * @param {string} slug
 * @returns {object|undefined}
 */
export const productBySlug = (tenantId, slug) =>
  db().prepare('SELECT * FROM products WHERE tenant_id = ? AND slug = ?').get(tenantId, slug)

/**
 * 判断店铺下是否已存在同名标识。
 * @param {number} tenantId
 * @param {string} slug
 * @returns {boolean}
 */
export const existsBySlug = (tenantId, slug) =>
  !!db().prepare('SELECT 1 FROM products WHERE tenant_id = ? AND slug = ?').get(tenantId, slug)

/**
 * 查询店铺下的商品，附带已发布文章数；all 为 false 时只返回已发布商品。
 * @param {number} tenantId
 * @param {boolean} [all] 是否包含草稿
 * @returns {object[]}
 */
export function productsForTenant(tenantId, all = false) {
  return db()
    .prepare(
      `SELECT p.*,
              (SELECT count(*) FROM articles a WHERE a.product_id = p.id AND a.status = 'published') article_count
         FROM products p
        WHERE tenant_id = ?${all ? '' : " AND status = 'published'"}
        ORDER BY id DESC`,
    )
    .all(tenantId)
}

/**
 * 取商品 id 及其所属店铺的到期时间，用于校验创作者是否有权发文。
 * @param {number} productId
 * @param {number} ownerId 创作者用户 id
 * @returns {object|undefined} {id, period_end}
 */
export function productOwnerContext(productId, ownerId) {
  return db()
    .prepare(
      `SELECT p.id, t.period_end
         FROM products p
         JOIN tenants t ON t.id = p.tenant_id
        WHERE p.id = ? AND t.owner_id = ?`,
    )
    .get(productId, ownerId)
}

/**
 * 发现页：已发布商品，附带店铺名/标识、文章数与已支付销量。
 * @param {number} limit
 * @returns {object[]}
 */
export function publishedWithStore(limit) {
  return db()
    .prepare(
      `SELECT p.*,
              t.name store_name,
              t.slug store_slug,
              t.partner_enabled,
              t.commission_rate,
              (SELECT count(*) FROM articles a WHERE a.product_id = p.id AND a.status = 'published') article_count,
              (SELECT count(*) FROM orders o WHERE o.product_id = p.id AND o.status = 'paid') sales
         FROM products p
         JOIN tenants t ON t.id = p.tenant_id
        WHERE p.status = 'published'
        ORDER BY sales DESC, p.id DESC
        LIMIT ?`,
    )
    .all(limit)
}

/** 统计平台商品总数 */
export const countProducts = () => db().prepare('SELECT count(*) n FROM products').get().n
