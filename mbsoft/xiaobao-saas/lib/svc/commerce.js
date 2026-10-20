// 交易服务：下单、模拟支付、订单列表与阅读权益。
// pay() 是唯一的事务边界：写支付流水、改订单、续期月租或发放权益，且可重复调用（幂等）。

import { db } from '../db/client.js'
import { now } from '../dates.js'
import { AppError } from '../errors.js'
import { newId } from '../auth/crypto.js'
import { mockPayEnabled, SAAS_PRICE_CENTS, SUBSCRIPTION_SECONDS } from '../config.js'
import * as products from '../repo/products.js'
import * as tenants from '../repo/tenants.js'
import * as orders from '../repo/orders.js'
import * as entitlements from '../repo/entitlements.js'
import * as referrals from '../repo/referrals.js'
import * as commissions from '../repo/commissions.js'
import * as wallets from '../repo/wallets.js'

/** 月租订单在订单表里展示的商品名 */
const SAAS_ORDER_NAME = '创作者月租'
/** 模拟支付渠道标识 */
const PAY_CHANNEL = 'wechat_mock'

/**
 * 创建待支付订单并返回订单号；kind 为 'saas' 时创建月租订单。
 * @param {number} userId 买家 id
 * @param {'saas'|'product'} kind
 * @param {string|number} [productId] 商品 id，月租订单可省略
 * @param {string|null} [refCode] 推广码，经推广链接下单时带上
 * @returns {string} 订单号
 */
export function createOrder(userId, kind, productId, refCode) {
  const product = kind === 'saas' ? null : products.productById(Number(productId))
  if (kind !== 'saas' && (!product || product.status !== 'published')) throw new AppError('商品不存在')
  const tenant = kind === 'saas' ? tenants.tenantByOwner(userId) : { id: product.tenant_id }
  const orderNo = newId('O')
  orders.insertOrder({
    orderNo,
    kind,
    tenantId: tenant.id,
    buyerId: userId,
    productId: product?.id || null,
    productName: product?.name || SAAS_ORDER_NAME,
    amountCents: product?.price_cents || SAAS_PRICE_CENTS,
    status: 'pending',
    createdAt: now(),
    refCode: refCode || null,
  })
  return orderNo
}

/**
 * 订单结算事务（pay 与 confirmPayment 共用）：写支付流水、改订单、
 * 续期月租或发放权益并计算分销佣金。幂等，已支付订单直接返回。
 * 调用方负责开启事务与参数校验。
 * @param {object} order 订单整行
 * @param {number} buyerId 买家 id（校验归属）
 * @param {string} channel 支付渠道标识
 */
function settleOrder(order, buyerId, channel) {
  const d = db()
  d.exec('BEGIN IMMEDIATE')
  try {
    const row = orders.orderByNoAndBuyer(order.order_no, buyerId)
    if (!row) throw new AppError('订单不存在')
    if (row.status === 'paid') {
      d.exec('COMMIT')
      return
    }
    const paidAt = now()
    orders.insertPayment({ paymentNo: newId('P'), orderId: row.id, channel, paidAt })
    orders.markPaid(row.id, paidAt)
    if (row.kind === 'saas') {
      tenants.extendPeriod(row.tenant_id, SUBSCRIPTION_SECONDS, paidAt)
    } else {
      const granted = entitlements.findByBuyerAndProduct(buyerId, row.product_id)
      const product = products.productById(row.product_id)
      const expiresAt =
        product.mode === 'lifetime'
          ? null
          : Math.max(paidAt, granted?.expires_at || 0) + SUBSCRIPTION_SECONDS
      entitlements.upsert({
        buyerId,
        productId: row.product_id,
        sourceOrderId: row.id,
        expiresAt,
      })
      // 分销计佣：订单带推广码、推广者不是买家本人、且店铺已开启合伙人计划时，
      // 按店铺设置的佣金比例记一笔待结算佣金，并同步增加推广者钱包可提现余额。
      const ref = row.ref_code ? referrals.referralByCode(row.ref_code) : null
      const partner = row.tenant_id ? tenants.partnerSettings(row.tenant_id) : null
      const canCommission =
        ref && ref.user_id !== buyerId && partner && partner.partner_enabled && partner.commission_rate > 0
      if (canCommission) {
        const amountCents = Math.round(row.amount_cents * partner.commission_rate)
        commissions.insertCommission({
          orderId: row.id,
          referrerId: ref.user_id,
          amountCents,
          createdAt: paidAt,
        })
        wallets.addAvailable(ref.user_id, amountCents)
      }
    }
    d.exec('COMMIT')
  } catch (err) {
    d.exec('ROLLBACK')
    throw err
  }
}

/**
 * 模拟微信支付：幂等，重复调用只会在首次生效。
 * 月租订单续期店铺有效期，商品订单按买断/订阅发放或续期权益。
 * @param {number} userId 买家 id，同时用于校验订单归属
 * @param {string} orderNo 订单号
 */
export function pay(userId, orderNo) {
  if (!mockPayEnabled()) throw new AppError('模拟支付未开启')
  const order = orders.orderByNoAndBuyer(orderNo, userId)
  if (!order) throw new AppError('订单不存在')
  settleOrder(order, userId, PAY_CHANNEL)
}

/**
 * 读者申报已付款（店铺自收款流程）：扫码支付给店主后提交确认。
 * 仅商品订单可申报；订单进入「待确认」，权益由店主确认收款后发放。
 * @param {number} userId 买家 id
 * @param {string} orderNo 订单号
 */
export function requestConfirm(userId, orderNo) {
  const order = orders.orderByNoAndBuyer(orderNo, userId)
  if (!order) throw new AppError('订单不存在')
  if (order.kind !== 'product') throw new AppError('仅商品订单需要确认收款')
  if (order.status !== 'pending') throw new AppError('订单状态已变化，请刷新')
  orders.markConfirmRequested(order.id)
}

/**
 * 店主确认收款（店铺自收款流程）：校验订单归属后走统一结算事务，
 * 发放阅读权益并计算分销佣金。幂等，已确认订单重复确认无副作用。
 * @param {number} userId 店主用户 id
 * @param {number} orderId 订单 id
 */
export function confirmPayment(userId, orderId) {
  const tenant = tenants.tenantByOwner(userId)
  if (!tenant) throw new AppError('店铺不存在')
  const order = orders.orderById(Number(orderId))
  if (!order || order.tenant_id !== tenant.id) throw new AppError('订单不存在')
  if (order.kind !== 'product') throw new AppError('仅商品订单需要确认收款')
  if (order.status === 'paid') return
  if (!order.confirm_requested) throw new AppError('读者尚未申报付款')
  settleOrder(order, order.buyer_id, 'self_qr')
}

/**
 * 查询买家全部订单（含月租订单），按创建时间倒序。
 * @param {number} userId
 * @returns {object[]}
 */
export const ordersForUser = (userId) => orders.ordersForUser(userId)

/**
 * 查询店铺收到的商品订单，附带买家邮箱。
 * @param {number} tenantId
 * @returns {object[]}
 */
export const ordersForTenant = (tenantId) => orders.ordersForTenant(tenantId)

/**
 * 查询买家未过期的已购内容，附带商品名与店铺名。
 * @param {number} userId
 * @returns {object[]}
 */
export const library = (userId) => entitlements.libraryFor(userId, now())

/**
 * 判断用户是否拥有某商品的阅读权：
 * 已购买（权益未过期）或用户即该商品所属专栏的 owner（作者本人免权益）。
 * @param {number} userId
 * @param {number} productId
 * @returns {boolean}
 */
export function canRead(userId, productId) {
  if (entitlements.hasAccess(userId, productId, now())) return true
  const product = products.productById(Number(productId))
  const tenant = product && tenants.tenantById(product.tenant_id)
  return !!(tenant && tenant.owner_id === userId)
}
