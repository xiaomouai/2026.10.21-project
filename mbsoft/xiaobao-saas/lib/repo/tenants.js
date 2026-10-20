// tenants 表读写：店铺资料、月租到期时间查询与续期。

import { db } from '../db/client.js'

/**
 * 创建店铺，periodEnd 默认 0（未开通）。
 * @param {{ownerId: number, name: string, slug: string, description?: string, periodEnd?: number}} row
 * @returns {number} 新店铺 id
 */
export function insertTenant({ ownerId, name, slug, description = '', periodEnd = 0, createdAt = 0 }) {
  const res = db()
    .prepare('INSERT INTO tenants (owner_id, name, slug, description, period_end, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(ownerId, name, slug, description, periodEnd, createdAt)
  return Number(res.lastInsertRowid)
}

/**
 * 按 owner 查店铺整行。
 * @param {number} ownerId
 * @returns {object|undefined}
 */
export const tenantByOwner = (ownerId) => db().prepare('SELECT * FROM tenants WHERE owner_id = ?').get(ownerId)

/**
 * 按 slug 查店铺整行。
 * @param {string} slug
 * @returns {object|undefined}
 */
export const tenantBySlug = (slug) => db().prepare('SELECT * FROM tenants WHERE slug = ?').get(slug)

/**
 * 按 id 查店铺整行。
 * @param {number} id
 * @returns {object|undefined}
 */
export const tenantById = (id) => db().prepare('SELECT * FROM tenants WHERE id = ?').get(id)

/**
 * 更新店铺名称、地址标识、简介与介绍页（Markdown）。
 * intro 未传时保留原值，避免只改简介的表单把介绍页清空。
 * @param {number} id
 * @param {{name: string, slug: string, description: string, intro?: string}} data
 */
export function updateProfile(id, { name, slug, description, intro }) {
  db()
    .prepare(
      'UPDATE tenants SET name = ?, slug = ?, description = ?, intro = COALESCE(?, intro) WHERE id = ?',
    )
    .run(name, slug, description, intro ?? null, id)
}

/**
 * 续期月租：到期时间取「当前时间与原到期时间的较大值」再叠加秒数。
 * @param {number} id 店铺 id
 * @param {number} seconds 续期秒数
 * @param {number} nowTs 当前秒级时间戳
 */
export function extendPeriod(id, seconds, nowTs) {
  db().prepare('UPDATE tenants SET period_end = max(?, period_end) + ? WHERE id = ?').run(nowTs, seconds, id)
}

/**
 * 更新店铺收款二维码（data URL）；传 null 时清除。
 * @param {number} id
 * @param {string|null} payQr 二维码图片 data URL，null 表示清除
 */
export function updatePayQr(id, payQr) {
  db().prepare('UPDATE tenants SET pay_qr = ? WHERE id = ?').run(payQr || '', id)
}

/**
 * 更新合伙人计划设置：是否开启与佣金比例（0~1）。
 * @param {number} id 店铺 id
 * @param {{partnerEnabled: boolean, commissionRate: number}} data
 */
export function updatePartner(id, { partnerEnabled, commissionRate }) {
  db()
    .prepare('UPDATE tenants SET partner_enabled = ?, commission_rate = ? WHERE id = ?')
    .run(partnerEnabled ? 1 : 0, commissionRate, id)
}

/**
 * 取店铺的合伙人计划设置。
 * @param {number} id 店铺 id
 * @returns {{partner_enabled: number, commission_rate: number}}
 */
export const partnerSettings = (id) =>
  db().prepare('SELECT partner_enabled, commission_rate FROM tenants WHERE id = ?').get(id)

/** 统计平台店铺总数 */
export const countTenants = () => db().prepare('SELECT count(*) n FROM tenants').get().n

/**
 * 店铺统计：订阅者数（已付费订单去重买家）、已发布文章数、服务天数。
 * @param {number} tenantId
 * @returns {{ subscribers: number, articles: number, days: number }}
 */
export function storeStats(tenantId) {
  const subscribers =
    db()
      .prepare(`SELECT count(DISTINCT buyer_id) n FROM orders WHERE tenant_id = ? AND status = 'paid'`)
      .get(tenantId).n || 0
  const articles =
    db()
      .prepare(
        `SELECT count(*) n FROM articles a JOIN products p ON p.id = a.product_id WHERE p.tenant_id = ? AND a.status = 'published'`,
      )
      .get(tenantId).n || 0
  const row = db().prepare('SELECT created_at FROM tenants WHERE id = ?').get(tenantId)
  const ts = row && row.created_at ? row.created_at : 0
  const days = ts ? Math.max(1, Math.ceil((Date.now() / 1000 - ts) / 86400)) : 1
  return { subscribers, articles, days }
}
