// 创作者后台服务：店铺设置、发布商品、发布文章。
// 这里是「套餐是否有效」「标识是否合法」等规则的唯一判定处。

import { now } from '../dates.js'
import { AppError } from '../errors.js'
import { toCents } from '../money.js'
import * as tenants from '../repo/tenants.js'
import * as products from '../repo/products.js'
import * as articles from '../repo/articles.js'

/** 商品标识白名单：仅小写字母、数字与连字符 */
const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9-]/g, '')

/**
 * 保存店铺资料，标识会被清洗成合法 slug。
 * intro（介绍页正文）仅在表单携带时更新，Markdown 格式。
 * @param {number} userId 创作者用户 id
 * @param {{name: string, slug: string, description: string, intro?: string}} data 表单字段
 */
export function saveStore(userId, data) {
  const tenant = tenants.tenantByOwner(userId)
  tenants.updateProfile(tenant.id, {
    name: data.name,
    slug: slugify(data.slug),
    description: data.description,
    intro: data.intro,
  })
}

/**
 * 发布商品，要求创作者套餐在有效期内且标识在店铺内唯一。
 * @param {number} userId 创作者用户 id
 * @param {{name: string, slug: string, description: string, audience: string, price: string|number, mode: string}} data
 */
export function addProduct(userId, data) {
  const tenant = tenants.tenantByOwner(userId)
  if (!tenant || tenant.period_end <= now()) throw new AppError('请先开通创作者套餐')
  const slug = slugify(data.slug)
  if (!slug) throw new AppError('商品标识只能使用英文小写、数字和连字符')
  if (products.existsBySlug(tenant.id, slug)) throw new AppError('该商品标识已存在，请换一个')
  products.insertProduct({
    tenantId: tenant.id,
    name: data.name,
    slug,
    description: data.description,
    audience: data.audience,
    priceCents: toCents(data.price),
    mode: data.mode,
    status: 'published',
  })
}

/**
 * 发布文章，要求商品属于该创作者且套餐未过期。
 * @param {number} userId 创作者用户 id
 * @param {{productId: string|number, title: string, summary: string, body: string, tag: string}} data
 */
export function addArticle(userId, data) {
  const product = products.productOwnerContext(Number(data.productId), userId)
  if (!product) throw new AppError('商品不存在')
  if (product.period_end <= now()) throw new AppError('创作者套餐已过期')
  articles.insertArticle({
    productId: product.id,
    title: data.title,
    summary: data.summary,
    body: data.body,
    tag: data.tag,
    status: 'published',
    createdAt: now(),
  })
}

/**
 * 编辑已有文章：校验归属（商品必须属于该创作者）与套餐有效期后整体更新。
 * 正文为 Markdown，阅读页与编辑器预览共用 renderMarkdown 渲染。
 * @param {number} userId 创作者用户 id
 * @param {{articleId: string|number, title: string, summary: string, body: string, tag: string, status?: string}} data
 */
export function updateArticle(userId, data) {
  const article = articles.articleById(Number(data.articleId))
  if (!article) throw new AppError('商品不存在')
  const product = products.productOwnerContext(article.product_id, userId)
  if (!product) throw new AppError('商品不存在')
  if (product.period_end <= now()) throw new AppError('创作者套餐已过期')
  articles.updateArticle(Number(data.articleId), {
    title: data.title,
    summary: data.summary,
    body: data.body,
    tag: data.tag,
    status: articleStatus(data.status),
  })
}

/**
 * 删除文章：校验文章归属（商品必须属于该创作者）后硬删除。
 * @param {number} userId 创作者用户 id
 * @param {number} articleId 文章 id
 * @returns {{ slug: string }} 所属店铺 slug，便于 action 跳回专栏页
 */
export function deleteArticle(userId, articleId) {
  const article = articles.articleById(Number(articleId))
  if (!article) throw new AppError('文章不存在')
  const product = products.productOwnerContext(article.product_id, userId)
  if (!product) throw new AppError('文章不存在')
  articles.deleteArticle(article.id)
  // articleById 的 JOIN 已带店铺 id，用于跳回专栏页
  return { slug: tenants.tenantById(article.tenant_id)?.slug }
}

/** 收款二维码大小上限：data URL 字符 1MB（约对应 700KB 图片） */
const PAY_QR_MAX_CHARS = 1024 * 1024

/**
 * 保存店铺收款二维码（data URL）；传空串清除。
 * 绑定后读者在收银台扫码直接向店主付款，订单由店主确认收款。
 * @param {number} userId 创作者用户 id
 * @param {string} dataUrl 图片 data URL（image/*），空串表示清除
 */
export function savePayQr(userId, dataUrl) {
  const tenant = tenants.tenantByOwner(userId)
  const value = String(dataUrl || '')
  if (value && !/^data:image\//.test(value)) throw new AppError('请上传图片文件')
  if (value.length > PAY_QR_MAX_CHARS) throw new AppError('图片过大，请压缩后再上传')
  tenants.updatePayQr(tenant.id, value || null)
}

/**
 * 标签管理：店铺内整体重命名或清除标签。
 * @param {number} userId 创作者用户 id
 * @param {{ op: 'rename'|'delete', from: string, to?: string }} data
 * @returns {{ slug: string, changed: number }}
 */
export function manageTags(userId, data) {
  const tenant = tenants.tenantByOwner(userId)
  const from = String(data.from || '').trim()
  if (!from) throw new AppError('标签不能为空')
  let changed = 0
  if (data.op === 'rename') {
    const to = String(data.to || '').trim()
    if (!to) throw new AppError('新标签名不能为空')
    if (to === from) return { slug: tenant.slug, changed: 0 }
    changed = articles.renameTag(tenant.id, from, to)
  } else if (data.op === 'delete') {
    changed = articles.clearTag(tenant.id, from)
  } else {
    throw new AppError('不支持的操作')
  }
  return { slug: tenant.slug, changed }
}
