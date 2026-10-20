// 目录与内容读取服务：店铺页、商品详情页、文章阅读页的只读查询入口。
// 读路径不含业务规则，直接透传 repo 的结果。

import * as tenants from '../repo/tenants.js'
import * as products from '../repo/products.js'
import * as articles from '../repo/articles.js'
import * as users from '../repo/users.js'

/**
 * 按 slug 取店铺整行，不存在返回 undefined。
 * @param {string} slug
 * @returns {object|undefined}
 */
export const tenantBySlug = (slug) => tenants.tenantBySlug(slug)

/**
 * 按 id 取店铺整行，不存在返回 undefined（阅读页回链店铺用）。
 * @param {number} id
 * @returns {object|undefined}
 */
export const tenantById = (id) => tenants.tenantById(id)

/**
 * 取店铺下的商品列表，默认只返回已发布商品。
 * @param {number} tenantId
 * @param {boolean} [all] 传 true 时包含草稿（创作者后台用）
 * @returns {object[]}
 */
export const productsForTenant = (tenantId, all = false) => products.productsForTenant(tenantId, all)

/**
 * 按店铺 id + slug 取商品。
 * @param {number} tenantId
 * @param {string} slug
 * @returns {object|undefined}
 */
export const productBySlug = (tenantId, slug) => products.productBySlug(tenantId, slug)

/**
 * 按 id 取商品。
 * @param {number} id
 * @returns {object|undefined}
 */
export const productById = (id) => products.productById(id)

/**
 * 取商品下的文章列表，默认只返回已发布文章。
 * @param {number} productId
 * @param {boolean} [all] 传 true 时包含草稿
 * @returns {object[]}
 */
export const articlesForProduct = (productId, all = false) => articles.articlesForProduct(productId, all)

/**
 * 按 id 取文章，附带所属商品名与店铺 id。
 * @param {number} id
 * @returns {object|undefined}
 */
export const articleById = (id) => articles.articleById(id)

/**
 * 取店铺下所有已发布文章（跨商品聚合），用于专栏页文章流。
 * @param {number} tenantId
 * @returns {object[]}
 */
export const articlesForTenant = (tenantId) => articles.articlesForTenant(tenantId)

/**
 * 取店铺文章的标签聚合（标签名 + 出现次数）。
 * @param {number} tenantId
 * @returns {{ tag: string, count: number }[]}
 */
export const tagsForTenant = (tenantId) => articles.tagsForTenant(tenantId)

/**
 * 店铺统计：订阅者数 / 已发布文章数 / 服务天数。
 * @param {number} tenantId
 * @returns {{ subscribers: number, articles: number, days: number }}
 */
export const storeStats = (tenantId) => tenants.storeStats(tenantId)

/**
 * 按 id 取用户整行（店铺 owner 信息用）。
 * @param {number} id
 * @returns {object|undefined}
 */
export const userById = (id) => users.userById(id)
