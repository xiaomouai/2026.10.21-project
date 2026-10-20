'use server'
// 创作者后台的 Server Action：店铺设置、发布商品、发布文章、创建月租订单。
// 每个 action 都先经 requireRole('creator') 鉴权；业务规则错误以内联 { error } 返回给 useFormState。
// 注意：redirect() 抛出的 NEXT_REDIRECT 不能被 catch 吞掉，因此只捕获 AppError。

import { redirect } from 'next/navigation'
import {
  AppError,
  addArticle,
  addProduct,
  confirmPayment,
  createOrder,
  deleteArticle,
  manageTags,
  savePayQr,
  saveStore,
  tenantById,
  updateArticle,
  updatePartnerSettings,
} from '@/lib'
import { requireRole } from '@/lib/auth/session'

/** 保存店铺资料（名称 / 地址标识 / 简介），成功后回到创作者后台 */
export async function saveStoreAction(prevState, formData) {
  const u = requireRole('creator')
  saveStore(u.id, Object.fromEntries(formData))
  redirect('/creator')
}

/**
 * 发布商品：套餐过期或标识重复时把错误信息内联回表单。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData 商品字段
 */
export async function addProductAction(prevState, formData) {
  const u = requireRole('creator')
  try {
    addProduct(u.id, Object.fromEntries(formData))
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
  redirect('/creator')
}

/**
 * 发布文章：商品不存在或套餐过期时把错误信息内联回表单。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData 文章字段
 */
export async function addArticleAction(prevState, formData) {
  const u = requireRole('creator')
  try {
    addArticle(u.id, Object.fromEntries(formData))
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
  redirect('/creator')
}

/**
 * 编辑文章：校验归属与套餐后整体更新，成功跳回文章列表。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData 文章字段（含隐藏的 articleId）
 */
export async function editArticleAction(prevState, formData) {
  const u = requireRole('creator')
  try {
    updateArticle(u.id, Object.fromEntries(formData))
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
  redirect('/creator/articles')
}

/**
 * 创建创作者月租订单并跳转模拟收银台；直接作为 form action 使用，不走 useFormState。
 * @param {FormData} formData 未使用，保留以匹配 form action 签名
 */
export async function billingAction(_formData) {
  const u = requireRole('creator')
  redirect('/checkout/' + createOrder(u.id, 'saas'))
}

/**
 * 保存合伙人计划设置：是否开启与佣金比例（百分比）。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData 含 enabled（复选框）与 ratePercent
 */
export async function updatePartnerAction(prevState, formData) {
  const u = requireRole('creator')
  const tenant = tenantById(u.tenant_id)
  const enabled = formData.get('enabled') === 'on'
  const ratePercent = Number(formData.get('ratePercent')) || 0
  try {
    updatePartnerSettings(tenant.id, { enabled, ratePercent })
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
  redirect('/creator/settings')
}

/**
 * 删除文章（专栏页 owner ⋮ 菜单触发）；成功后回到该店铺专栏页。
 * 直接作为 form action 使用，不走 useFormState。
 * @param {FormData} formData 含 articleId
 */
export async function deleteArticleAction(formData) {
  const u = requireRole('creator')
  const { slug } = deleteArticle(u.id, formData.get('articleId'))
  redirect(slug ? `/s/${slug}` : '/creator/articles')
}

/**
 * 保存收款二维码：表单传 dataUrl（图片 data URL），空值清除；成功后回到设置页。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData 含 dataUrl
 */
export async function savePayQrAction(prevState, formData) {
  const u = requireRole('creator')
  try {
    savePayQr(u.id, formData.get('dataUrl'))
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
  redirect('/creator/settings')
}

/**
 * 确认收款（店铺自收款流程）：发放权益并计分销佣金；直接作为 form action 使用。
 * @param {FormData} formData 含 orderId
 */
export async function confirmPaymentAction(formData) {
  const u = requireRole('creator')
  confirmPayment(u.id, formData.get('orderId'))
  redirect('/creator/orders')
}

/**
 * 标签管理：店铺内整体重命名或清除标签，成功后回到专栏页。
 * 直接作为 form action 使用；错误场景（空标签名）静默忽略由前端 required 兜底。
 * @param {FormData} formData 含 op（rename|delete）、from、to
 */
export async function manageTagsAction(formData) {
  const u = requireRole('creator')
  const { slug } = manageTags(u.id, {
    op: formData.get('op'),
    from: formData.get('from'),
    to: formData.get('to'),
  })
  redirect(slug ? `/s/${slug}` : '/creator/articles')
}
