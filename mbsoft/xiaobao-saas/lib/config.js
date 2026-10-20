// 全局配置集中地：数据库路径、会话、订阅周期、月租价格与模拟支付开关。
// 只有本文件允许直接读 process.env，其它模块一律从这里导入常量。

/** sqlite 数据库文件路径，可用环境变量 XIAOBAO_DB 覆盖，默认 xiaobao.db */
export const DB_PATH = process.env.XIAOBAO_DB || 'xiaobao.db'

/** 存放会话 token 的 cookie 名称 */
export const SESSION_COOKIE = 'xiaobao_session'

/** 会话有效期（秒）：30 天 */
export const SESSION_TTL = 30 * 86400

/** 订阅与月租的续期天数 */
export const SUBSCRIPTION_DAYS = 30

/** 订阅与月租的续期秒数，等于 SUBSCRIPTION_DAYS * 86400 */
export const SUBSCRIPTION_SECONDS = SUBSCRIPTION_DAYS * 86400

/** 创作者月租价格（分），即 ¥99/月 */
export const SAAS_PRICE_CENTS = 9900

/** 是否开启模拟微信支付，模块加载时的环境快照 */
export const MOCK_PAY_ENABLED = process.env.WECHAT_MOCK_ENABLED === 'true'

/** 实时判断是否开启模拟支付；环境变量可能在本模块加载之后才注入 */
export const mockPayEnabled = () => process.env.WECHAT_MOCK_ENABLED === 'true'

/** 系统内置的全部角色 */
export const ROLES = ['admin', 'creator', 'reader']

/** 允许自助注册的角色，管理员账号由首次登录时自动创建 */
export const REGISTERABLE_ROLES = ['creator', 'reader']

/** 内置平台管理员邮箱，首次用该邮箱登录会自动创建 admin 账号 */
export const ADMIN_EMAIL = 'admin@local.test'

/** 内置平台管理员初始密码 */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

/** 未登录或越权时统一跳转的地址 */
export const LOGIN_PATH = '/login'

/** 分销佣金比例（占订单实付金额），0.2 = 20%，作为新店铺默认比例 */
export const COMMISSION_RATE = 0.2

/** 分销佣金比例的百分数展示值，20 = 20% */
export const COMMISSION_PERCENT = COMMISSION_RATE * 100

/** 合伙人计划允许设置的佣金上限（占订单实付金额），0.4 = 40% */
export const PARTNER_MAX_RATE = 0.4

/** 合伙人计划佣金上限的百分数展示值，40 = 40% */
export const PARTNER_MAX_PERCENT = PARTNER_MAX_RATE * 100

/** 提现税费比例（云账户结算税务代申报），约 6.1% */
export const WITHDRAW_TAX_RATE = 0.061
