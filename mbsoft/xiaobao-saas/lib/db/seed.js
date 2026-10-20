// 演示数据：仅在库里还没有任何店铺时写入一次，保证全新环境开箱可用。
// 内容包含示例创作者账号、示例店铺 growth-notes、2 个商品与 4 篇文章。

import { now } from '../dates.js'
import { hashPassword } from '../auth/crypto.js'
import { SUBSCRIPTION_SECONDS } from '../config.js'

const DEMO_EMAIL = 'demo@creator.local'
const DEMO_PASSWORD = 'demo12345'
const DEMO_TENANT = {
  name: '增长手记',
  slug: 'growth-notes',
  description: '用真实实验记录小红书获客，不卖流量承诺。',
}
const DEMO_PRODUCTS = [
  {
    key: 'first-order',
    name: '小红书首单验证手册',
    description: '从需求验证到第一笔付款的可执行路径。',
    audience: '适合内容有发布但咨询与成交为0的创作者',
    priceCents: 9900,
    mode: 'lifetime',
    articles: [
      [
        '先验证需求，再做产品',
        '不要用点赞代替付款证据。',
        '从一个明确买家、一个高频问题和一个可带走结果开始。先发布验证帖，以有效咨询和付款作为继续投入的依据。',
        '需求验证',
      ],
      [
        '一篇帖子如何验证付费',
        '把购买动作写进内容。',
        '帖子只承诺一个具体结果，并设置明确价格与购买入口。24小时内记录曝光、有效咨询、报价和付款。',
        '成交',
      ],
    ],
  },
  {
    key: 'weekly-growth',
    name: '每周获客实验',
    description: '每周更新一个真实获客实验和复盘。',
    audience: '适合持续迭代内容与成交路径的商家',
    priceCents: 4900,
    mode: 'subscription',
    articles: [
      [
        '本周实验：99元诊断',
        '缩短从阅读到购买的距离。',
        '本周只测试一个99元账号诊断，页面写清交付物、时限和不适合人群。',
        '实验',
      ],
      [
        '复盘：为什么咨询仍为0',
        '先检查承诺和入口。',
        '如果阅读后没人行动，优先检查目标客户是否具体、结果是否可验证、入口是否清楚。',
        '复盘',
      ],
    ],
  },
]

/**
 * 写入演示数据；已有店铺时直接返回，可安全重复调用。
 * @param {import('node:sqlite').DatabaseSync} d 已连接的数据库实例
 */
export function seed(d) {
  if (d.prepare('SELECT count(*) n FROM tenants').get().n) return
  const createdAt = now()
  const user = d
    .prepare('INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
    .run(DEMO_EMAIL, hashPassword(DEMO_PASSWORD), 'creator', createdAt)
  const ownerId = Number(user.lastInsertRowid)
  const tenant = d
    .prepare('INSERT INTO tenants (owner_id, name, slug, description, period_end) VALUES (?, ?, ?, ?, ?)')
    .run(ownerId, DEMO_TENANT.name, DEMO_TENANT.slug, DEMO_TENANT.description, createdAt + SUBSCRIPTION_SECONDS)
  const tenantId = Number(tenant.lastInsertRowid)
  const insertProduct = d.prepare(
    `INSERT INTO products (tenant_id, name, slug, description, audience, price_cents, mode, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertArticle = d.prepare(
    `INSERT INTO articles (product_id, title, summary, body, tag, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const p of DEMO_PRODUCTS) {
    const row = insertProduct.run(
      tenantId,
      p.name,
      p.key,
      p.description,
      p.audience,
      p.priceCents,
      p.mode,
      'published',
    )
    const productId = Number(row.lastInsertRowid)
    for (const [title, summary, body, tag] of p.articles) {
      insertArticle.run(productId, title, summary, body, tag, 'published', createdAt)
    }
  }
}
