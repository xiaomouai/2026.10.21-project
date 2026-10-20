'use server'
// 认证域 Server Action：注册 / 登录 / 退出，只导出 async 函数。
// 会话 cookie 一律经 lib/auth/session 读写；redirect 抛出的 NEXT_REDIRECT 不能被 catch 吞掉。

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppError, SESSION_COOKIE, register, login, logout } from '@/lib'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth/session'

/**
 * 按角色返回登录后的落地页。
 * @param {'admin'|'creator'|'reader'} role
 * @returns {string}
 */
function homeByRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'creator') return '/creator'
  return '/library'
}

/**
 * 注册并直接登录：成功按角色跳转，失败返回 { error } 交给 useFormState 展示。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData
 */
export async function registerAction(prevState, formData) {
  const role = formData.get('role')
  try {
    const session = register(formData.get('email'), formData.get('password'), role)
    await setSessionCookie(session.token, session.expiresAt)
    redirect(role === 'creator' ? '/creator' : '/library')
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
}

/**
 * 登录：成功按角色分发到创作者中心 / 平台概览 / 我的内容，失败返回 { error }。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData
 */
export async function loginAction(prevState, formData) {
  try {
    const session = login(formData.get('email'), formData.get('password'))
    await setSessionCookie(session.token, session.expiresAt)
    redirect(homeByRole(session.user.role))
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
}

/**
 * 退出：直接给 form action 使用（不接 useFormState），销毁会话后回首页。
 * @param {FormData} _formData 表单 action 自动传入，退出无需读取
 */
export async function logoutAction(_formData) {
  logout(cookies().get(SESSION_COOKIE)?.value)
  await clearSessionCookie()
  redirect('/')
}
