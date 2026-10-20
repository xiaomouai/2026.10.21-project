// 领域层统一出口：页面与 Server Action 只从这里导入，不直接依赖内部目录。
// 对外 API 与旧 lib/db.js 完全一致，另加发现页所需的三个查询。

// 基础工具与错误
export { AppError, assert, fail, isUniqueError } from './errors.js'
export {
  DB_PATH,
  SESSION_COOKIE,
  SESSION_TTL,
  SUBSCRIPTION_DAYS,
  SUBSCRIPTION_SECONDS,
  SAAS_PRICE_CENTS,
  COMMISSION_RATE,
  COMMISSION_PERCENT,
  PARTNER_MAX_RATE,
  PARTNER_MAX_PERCENT,
  WITHDRAW_TAX_RATE,
  MOCK_PAY_ENABLED,
  mockPayEnabled,
  ROLES,
  REGISTERABLE_ROLES,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  LOGIN_PATH,
} from './config.js'
export { yuan, fmt, toCents } from './money.js'
export { now, fmtDate, fmtDateTime } from './dates.js'

// 数据库连接
export { db, migrate, reset } from './db/client.js'

// 认证与会话（账号体系）
export { register, login, logout, userByToken } from './svc/auth.js'

// 目录与内容读取
export {
  tenantBySlug,
  tenantById,
  productsForTenant,
  productBySlug,
  productById,
  articlesForProduct,
  articlesForTenant,
  tagsForTenant,
  articleById,
  storeStats,
  userById,
} from './svc/catalog.js'

// 创作者后台
export { saveStore, savePayQr, addProduct, addArticle, updateArticle, deleteArticle, manageTags } from './svc/creator.js'

// 交易与权益
export {
  createOrder,
  pay,
  requestConfirm,
  confirmPayment,
  ordersForUser,
  ordersForTenant,
  library,
  canRead,
} from './svc/commerce.js'

// 平台统计
export { adminStats } from './svc/admin.js'

// 精选发现
export { featuredProducts, discoverStores, productSalesCount } from './svc/discovery.js'

// 分销推广
export {
  myReferralCode,
  commissionsFor,
  commissionStats,
  promotableProducts,
  partnerSettings,
  updatePartnerSettings,
  partnerLeaderboard,
  wallet,
  requestWithdraw,
  withdrawalsFor,
} from './svc/distribution.js'
