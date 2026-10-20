// 分销推广服务：推广码生成、佣金查询、可推广商品，以及合伙人计划相关的
// 店铺设置、榜单、钱包余额与提现。

import { randomBytes } from 'node:crypto'
import { db } from '../db/client.js'
import { now } from '../dates.js'
import { AppError } from '../errors.js'
import { PARTNER_MAX_RATE, WITHDRAW_TAX_RATE } from '../config.js'
import * as referrals from '../repo/referrals.js'
import * as commissions from '../repo/commissions.js'
import * as products from '../repo/products.js'
import * as tenants from '../repo/tenants.js'
import * as orders from '../repo/orders.js'
import * as wallets from '../repo/wallets.js'
import * as withdrawals from '../repo/withdrawals.js'

/**
 * 取用户的推广码，没有则生成（'R' + 8 位 hex），碰撞时重试一次。
 * @param {number} userId
 * @returns {string} 推广码
 */
export function myReferralCode(userId) {
  const found = referrals.referralByUserId(userId)
  if (found) return found.code
  for (let i = 0; i < 2; i++) {
    const code = 'R' + randomBytes(4).toString('hex')
    try {
      referrals.insertReferral({ code, userId, createdAt: now() })
      return code
    } catch {
      // 推广码主键碰撞，重试一次后仍失败则抛出
      if (i === 1) throw new Error('推广码生成失败，请重试')
    }
  }
}

/**
 * 查询推广者的佣金明细，附带订单号/商品名/订单金额。
 * @param {number} userId
 * @returns {object[]}
 */
export const commissionsFor = (userId) => commissions.commissionsForReferrer(userId)

/**
 * 推广者佣金统计：累计佣金（分）与笔数。
 * @param {number} userId
 * @returns {{totalCents: number, count: number}}
 */
export function commissionStats(userId) {
  const row = commissions
    .commissionsForReferrer(userId)
    .reduce((acc, c) => ({ totalCents: acc.totalCents + c.amount_cents, count: acc.count + 1 }), {
      totalCents: 0,
      count: 0,
    })
  return row
}

/**
 * 可推广商品：已发布商品，附带店铺信息与销量。
 * @param {number} [limit] 返回条数
 * @returns {object[]}
 */
export const promotableProducts = (limit = 12) => products.publishedWithStore(limit)

/**
 * 取店铺的合伙人计划设置。
 * @param {number} tenantId
 * @returns {{enabled: boolean, rate: number, ratePercent: number}}
 */
export function partnerSettings(tenantId) {
  const row = tenants.partnerSettings(tenantId)
  const enabled = !!row?.partner_enabled
  const rate = enabled ? Number(row.commission_rate) : 0
  return { enabled, rate, ratePercent: Math.round(rate * 100) }
}

/**
 * 更新店铺合伙人计划设置：是否开启与佣金比例（百分数字段，0~40）。
 * @param {number} tenantId
 * @param {{enabled: boolean, ratePercent: number}} data
 */
export function updatePartnerSettings(tenantId, { enabled, ratePercent }) {
  const percent = Number(ratePercent)
  if (!Number.isFinite(percent) || percent < 0 || percent > PARTNER_MAX_RATE * 100) {
    throw new AppError(`佣金比例需在 0~${PARTNER_MAX_RATE * 100}% 之间`)
  }
  tenants.updatePartner(tenantId, { partnerEnabled: enabled, commissionRate: percent / 100 })
}

/**
 * 合伙人计划榜单：某店铺下按推广码聚合的推广者排行，支持时段筛选。
 * @param {number} tenantId
 * @param {'all'|'7d'|'30d'|'90d'} [range] 统计时段，默认全部
 * @returns {object[]} { code, referrer_email, buyers, sales_cents, orders_count }
 */
export function partnerLeaderboard(tenantId, range = 'all') {
  const days = { all: 0, '7d': 7, '30d': 30, '90d': 90 }[range] ?? 0
  const fromTs = days ? now() - days * 86400 : 0
  return orders.partnerLeaderboard(tenantId, fromTs)
}

/**
 * 推广者钱包：可提现余额、累计已提现（税后净额）与待结算佣金。
 * @param {number} userId
 * @returns {{availableCents: number, withdrawnCents: number, pendingCents: number}}
 */
export function wallet(userId) {
  const w = wallets.getOrCreate(userId)
  return {
    availableCents: w.available_cents,
    withdrawnCents: w.withdrawn_cents,
    pendingCents: commissions.commissionPendingSum(userId),
  }
}

/**
 * 申请提现：校验余额后于事务内扣减可提现、标记佣金已结算并写入提现记录。
 * 模拟环境即时打款，按 6.1% 计提税费。
 * @param {number} userId
 * @param {number} amountCents 税前提现金额（分）
 * @returns {{amountCents: number, taxCents: number, netCents: number}}
 */
export function requestWithdraw(userId, amountCents) {
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('请输入有效的提现金额')
  const w = wallets.getOrCreate(userId)
  if (amount > w.available_cents) throw new AppError('可提现余额不足')
  const taxCents = Math.round(amount * WITHDRAW_TAX_RATE)
  const netCents = amount - taxCents
  const d = db()
  d.exec('BEGIN IMMEDIATE')
  try {
    wallets.settleWithdraw(userId, amount, taxCents)
    commissions.markSettledForUser(userId)
    withdrawals.insert({ userId, amountCents: amount, taxCents, netCents, createdAt: now() })
    d.exec('COMMIT')
    return { amountCents: amount, taxCents, netCents }
  } catch (err) {
    d.exec('ROLLBACK')
    throw err
  }
}

/**
 * 推广者的提现记录。
 * @param {number} userId
 * @returns {object[]}
 */
export const withdrawalsFor = (userId) => withdrawals.listForUser(userId)
