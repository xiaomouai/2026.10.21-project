// GET /logout：全局导航的「退出」是 <a href="/logout">，因此必须支持 GET 访问。
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, logout } from '@/lib'

/**
 * 销毁服务端会话并清除 cookie，随后重定向回首页。
 * @returns {never}
 */
export function GET() {
  logout(cookies().get(SESSION_COOKIE)?.value)
  cookies().delete(SESSION_COOKIE)
  redirect('/')
}
