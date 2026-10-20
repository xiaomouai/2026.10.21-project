// articles 表读写：付费文章的查询与发布。

import { db } from '../db/client.js'

/**
 * 发布一篇文章。
 * @param {{productId: number, title: string, summary: string, body: string,
 *          tag: string, status: string, createdAt: number}} row
 * @returns {number} 新文章 id
 */
export function insertArticle({ productId, title, summary, body, tag, status, createdAt }) {
  const res = db()
    .prepare(
      `INSERT INTO articles (product_id, title, summary, body, tag, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(productId, title, summary, body, tag, status, createdAt)
  return Number(res.lastInsertRowid)
}

/**
 * 查询商品下的文章；all 为 false 时只返回已发布文章。
 * @param {number} productId
 * @param {boolean} [all] 是否包含草稿
 * @returns {object[]}
 */
export function articlesForProduct(productId, all = false) {
  return db()
    .prepare(`SELECT * FROM articles WHERE product_id = ?${all ? '' : " AND status = 'published'"} ORDER BY id`)
    .all(productId)
}

/**
 * 按 id 查文章，附带所属商品名与店铺 id。
 * @param {number} id
 * @returns {object|undefined}
 */
export function articleById(id) {
  return db()
    .prepare(
      `SELECT a.*, p.tenant_id, p.name product_name
         FROM articles a
         JOIN products p ON p.id = a.product_id
        WHERE a.id = ?`,
    )
    .get(id)
}

/**
 * 更新文章标题、摘要、正文、标签与状态。
 * @param {number} id 文章 id
 * @param {{title: string, summary: string, body: string, tag: string, status?: string}} data
 */
export function updateArticle(id, { title, summary, body, tag, status }) {
  db()
    .prepare(
      `UPDATE articles SET title = ?, summary = ?, body = ?, tag = ?, status = ? WHERE id = ?`,
    )
    .run(title, summary, body, tag, status || 'published', id)
}

/**
 * 查询店铺（tenant）下所有已发布文章，附带作者名与商品名。
 * 用于读者端专栏页的文章流。
 * @param {number} tenantId
 * @returns {object[]}
 */
export function articlesForTenant(tenantId) {
  return db()
    .prepare(
      `SELECT a.*, t.name author_name, p.name product_name
         FROM articles a
         JOIN products p ON p.id = a.product_id
         JOIN tenants t ON t.id = p.tenant_id  -- 文章作者即专栏主（店铺名）
        WHERE p.tenant_id = ?
          AND a.status = 'published'
        ORDER BY a.created_at DESC`,
    )
    .all(tenantId)
}

/**
 * 从店铺文章中提取标签及其出现次数。
 * @param {number} tenantId
 * @returns {{ tag: string, count: number }[]}
 */
export function tagsForTenant(tenantId) {
  const rows = db()
    .prepare(
      `SELECT a.tag, count(*) cnt
         FROM articles a
         JOIN products p ON p.id = a.product_id
        WHERE p.tenant_id = ? AND a.status = 'published' AND a.tag != ''
        GROUP BY a.tag
        ORDER BY cnt DESC`,
    )
    .all(tenantId)
  return rows.map((r) => ({ tag: r.tag, count: r.cnt }))
}

/**
 * 删除文章（硬删除）。文章未被订单/佣金等表引用，可安全删除。
 * @param {number} id 文章 id
 */
export function deleteArticle(id) {
  db().prepare('DELETE FROM articles WHERE id = ?').run(id)
}

/**
 * 店铺内把某标签整体重命名（跨该店铺所有文章）。
 * @param {number} tenantId 店铺 id
 * @param {string} from 原标签
 * @param {string} to 新标签
 * @returns {number} 受影响文章数
 */
export function renameTag(tenantId, from, to) {
  const res = db()
    .prepare(
      `UPDATE articles SET tag = ?
        WHERE tag = ?
          AND product_id IN (SELECT id FROM products WHERE tenant_id = ?)`,
    )
    .run(to, from, tenantId)
  return Number(res.changes)
}

/**
 * 店铺内清除某标签（文章本身保留，仅去掉标签）。
 * @param {number} tenantId 店铺 id
 * @param {string} tag 要清除的标签
 * @returns {number} 受影响文章数
 */
export function clearTag(tenantId, tag) {
  const res = db()
    .prepare(
      `UPDATE articles SET tag = ''
        WHERE tag = ?
          AND product_id IN (SELECT id FROM products WHERE tenant_id = ?)`,
    )
    .run(tag, tenantId)
  return Number(res.changes)
}
