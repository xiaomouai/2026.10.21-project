'use client'
// 创作者后台侧边导航：usePathname 高亮当前项，概览精确匹配，其余前缀匹配。

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** 菜单项清单：href 与后台子页面一一对应 */
const ITEMS = [
  { href: '/creator', label: '概览' },
  { href: '/creator/products', label: '商品' },
  { href: '/creator/articles', label: '文章' },
  { href: '/creator/orders', label: '订单' },
  { href: '/creator/partners', label: '合伙人' },
  { href: '/creator/settings', label: '店铺设置' },
]

/** 侧边导航：当前路由对应项加 .active 高亮 */
export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="sideNav">
      {ITEMS.map((item) => {
        const isActive =
          item.href === '/creator' ? pathname === '/creator' : pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} className={isActive ? 'active' : undefined}>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
