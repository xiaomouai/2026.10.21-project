// 精选发现服务：供「精选发现页」使用的商品与店铺聚合查询。
// 全部基于现有 orders/products 表做 join 聚合，不新增表。

import * as products from '../repo/products.js'
import * as orders from '../repo/orders.js'
import { db } from '../db/client.js'

/**
 * 精选商品：已发布商品，附带店铺名/标识、文章数与销量，按销量与创建时间排序。
 * @param {number} [limit] 返回条数
 * @returns {object[]}
 */
export const featuredProducts = (limit = 6) => products.publishedWithStore(limit)

/**
 * 精选店铺：至少有一个已发布商品的店铺，附带商品数。
 * @param {number} [limit] 返回条数
 * @returns {object[]}
 */
export function discoverStores(limit = 6) {
  return db()
    .prepare(
      `SELECT t.id, t.name, t.slug, t.description, count(p.id) product_count
         FROM tenants t
         JOIN products p ON p.tenant_id = t.id AND p.status = 'published'
        GROUP BY t.id
        ORDER BY product_count DESC, t.id DESC
        LIMIT ?`,
    )
    .all(limit)
}

/**
 * 商品销量：该商品已支付订单数。
 * @param {number} productId
 * @returns {number}
 */
export const productSalesCount = (productId) => orders.countPaidByProduct(productId)
