// 创作者后台 shell：左侧店铺栏 + 导航，右侧内容区。
// 只做鉴权与框架渲染，各子页面自行 requireRole 取数（幂等、开销极小）。

import { fmtDate, now } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import { logoutAction } from '@/app/actions/auth'
import SidebarNav from './SidebarNav'

export const dynamic = 'force-dynamic'

/** 创作者后台两栏布局：侧边栏固定，右侧渲染子页面 */
export default function Layout({ children }) {
  const u = requireRole('creator')
  const active = u.period_end > now()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sideBrand">
          <b>{u.tenant_name}</b>
          <span>{active ? `套餐有效至 ${fmtDate(u.period_end)}` : '套餐未开通'}</span>
        </div>
        <SidebarNav />
        <form action={logoutAction} className="sideFoot">
          <button className="secondary" type="submit">
            退出登录
          </button>
        </form>
      </aside>
      <main className="sideMain">{children}</main>
    </div>
  )
}
