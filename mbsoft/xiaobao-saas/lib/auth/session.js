// server-only：本模块使用 next/headers，禁止在客户端组件或纯 Node 脚本中导入。
// 注意：Next 14 里 cookies().set() 只允许在 Server Action / Route Handler 中调用，
// 因此 setSessionCookie / clearSessionCookie 只能被 Server Action 使用，页面组件里只能读。

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, LOGIN_PATH } from '../config.js'
import { userByToken } from '../svc/auth.js'

/**
 * 读取当前登录用户（含店铺信息），未登录返回 null。
 * @returns {object|null}
 */
export function currentUser() {
  return userByToken(cookies().get(SESSION_COOKIE)?.value)
}

/**
 * 要求已登录，否则跳转登录页。
 * @returns {object} 当前用户
 */
export function requireUser() {
  const user = currentUser()
  if (!user) redirect(LOGIN_PATH)
  return user
}

/**
 * 要求当前用户属于给定角色之一，否则跳转登录页。
 * @param {...'admin'|'creator'|'reader'} roles 允许的角色
 * @returns {object} 当前用户
 */
export function requireRole(...roles) {
  const user = requireUser()
  if (!roles.includes(user.role)) redirect(LOGIN_PATH)
  return user
}

/**
 * 写入会话 cookie；仅限 Server Action / Route Handler 调用。
 * @param {string} rawToken 原始 token（不落库原文）
 * @param {number} expiresAt 秒级过期时间
 */
export async function setSessionCookie(rawToken, expiresAt) {
  cookies().set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt * 1000),
  })
}

/**
 * 清除会话 cookie；仅限 Server Action / Route Handler 调用（服务端会话记录需另调 logout）。
 */
export async function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE)
}
