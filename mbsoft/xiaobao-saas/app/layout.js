import './styles/tokens.css'
import './styles/base.css'
import './styles/marketing.css'
import './styles/dashboard.css'
import { currentUser } from '@/lib/auth/session'
import ThemeToggle from '@/app/components/ThemeToggle'

export const metadata = {
  title: '知栈｜创作者知识商店',
  description: '多商品知识付费 SaaS',
}

// 移动端视口：显式声明，保证手机端按设备宽度渲染不缩放
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

// 角色感知导航：未登录 / creator / reader / admin 各一套，退出走 /logout 链接
const NAV = {
  creator: [
    { href: '/', label: '发现' },
    { href: '/creator', label: '创作者中心' },
    { href: '/library', label: '我的内容' },
    { href: '/affiliate', label: '分销中心' },
  ],
  reader: [
    { href: '/', label: '发现' },
    { href: '/library', label: '我的内容' },
    { href: '/affiliate', label: '分销中心' },
  ],
  admin: [
    { href: '/', label: '发现' },
    { href: '/admin', label: '平台概览' },
  ],
}

const GUEST_NAV = [
  { href: '/', label: '发现' },
  { href: '/login', label: '登录' },
  { href: '/register', label: '注册' },
]

// 防闪烁：在 React 接管前根据 localStorage 设定主题，避免刷新瞬间闪默认浅色
const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('zhizhan-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})()"

export default async function Layout({ children }) {
  const user = await currentUser()
  const links = (user && NAV[user.role]) || GUEST_NAV

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <header>
          <a href="/" className="brand">
            <b>知</b>知栈
          </a>
          <nav>
            {links.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
            <ThemeToggle />
            {user ? <a href="/logout">退出</a> : null}
          </nav>
        </header>
        {children}
        <footer>
          <div className="footInner">
            <span>© 2026 知栈 Zhizhan · 保留所有权利</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
              京ICP备2026000000号-1
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
