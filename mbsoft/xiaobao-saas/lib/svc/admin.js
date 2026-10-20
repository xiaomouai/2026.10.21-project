// 平台运营统计服务：管理员概览页的四项指标。

import * as tenants from '../repo/tenants.js'
import * as products from '../repo/products.js'
import * as orders from '../repo/orders.js'

/**
 * 平台概览：创作者数、商品数、商品订单数与已支付交易额（分）。
 * @returns {{tenants: number, products: number, orders: number, paid: number}}
 */
export function adminStats() {
  return {
    tenants: tenants.countTenants(),
    products: products.countProducts(),
    orders: orders.countProductOrders(),
    paid: orders.sumPaidProductCents(),
  }
}
