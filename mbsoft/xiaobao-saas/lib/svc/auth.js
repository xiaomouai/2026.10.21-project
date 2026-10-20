// 认证与会话服务：注册、登录、退出、按 token 取当前用户。
// 这里是事务边界，所有校验失败都抛 AppError。

import { db } from '../db/client.js'
import { now } from '../dates.js'
import { AppError, isUniqueError } from '../errors.js'
import { hashPassword, verifyPassword, newId, hashToken } from '../auth/crypto.js'
import { insertUser, userByEmail } from '../repo/users.js'
import { insertSession, deleteSession, userWithTenantByTokenHash } from '../repo/sessions.js'
import { insertTenant } from '../repo/tenants.js'
import { SESSION_TTL, REGISTERABLE_ROLES, ADMIN_EMAIL, ADMIN_PASSWORD } from '../config.js'

/** 邮箱格式校验，与注册页 input[type=email] 的规则保持一致 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 注册账号并直接返回会话；创作者会顺带创建默认店铺（未开通套餐）。
 * @param {string} email
 * @param {string} password 明文口令
 * @param {'creator'|'reader'} role
 * @returns {{token: string, expiresAt: number, user: object}}
 */
export function register(email, password, role) {
  email = String(email).trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new AppError('请输入有效邮箱')
  if (password.length < 8) throw new AppError('密码至少8位')
  if (!REGISTERABLE_ROLES.includes(role)) throw new AppError('请选择账户类型')
  const d = db()
  d.exec('BEGIN')
  try {
    const userId = insertUser({ email, passwordHash: hashPassword(password), role, createdAt: now() })
    if (role === 'creator') {
      const base = email.split('@')[0].replace(/[^a-z0-9]/g, '-').slice(0, 20) || 'creator'
      insertTenant({
        ownerId: userId,
        name: '我的知识店铺',
        slug: `${base}-${userId}`,
        description: '请填写你的店铺简介',
        createdAt: now(),
      })
    }
    d.exec('COMMIT')
    return createSession(userId)
  } catch (err) {
    d.exec('ROLLBACK')
    if (isUniqueError(err)) throw new AppError('该邮箱已注册')
    throw err
  }
}

/**
 * 登录并返回会话；内置管理员邮箱首次登录时自动建号。
 * @param {string} email
 * @param {string} password 明文口令
 * @returns {{token: string, expiresAt: number, user: object}}
 */
export function login(email, password) {
  email = String(email).trim().toLowerCase()
  let user = userByEmail(email)
  if (!user && ADMIN_PASSWORD && email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const adminId = insertUser({
      email,
      passwordHash: hashPassword(password),
      role: 'admin',
      createdAt: now(),
    })
    user = { id: adminId }
  }
  if (!user || (user.password_hash ? !verifyPassword(password, user.password_hash) : false)) {
    throw new AppError('邮箱或密码错误', 401)
  }
  return createSession(user.id)
}

/**
 * 按原始 token 取当前用户（含店铺信息），无效或过期返回 null。
 * @param {string} raw cookie 里的原始 token
 * @returns {object|null}
 */
export function userByToken(raw) {
  if (!raw) return null
  return userWithTenantByTokenHash(hashToken(raw), now()) || null
}

/**
 * 销毁会话，使 token 立即失效。
 * @param {string} raw cookie 里的原始 token
 */
export function logout(raw) {
  if (raw) deleteSession(hashToken(raw))
}

/**
 * 建会话并落库，返回给调用方写 cookie 所需的 token 与过期时间。
 * @param {number} userId
 * @returns {{token: string, expiresAt: number, user: object}}
 */
function createSession(userId) {
  const token = newId('S')
  const expiresAt = now() + SESSION_TTL
  insertSession({ tokenHash: hashToken(token), userId, expiresAt })
  return { token, expiresAt, user: userByToken(token) }
}
