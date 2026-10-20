import Link from 'next/link'
import './store.css'

export const metadata = { title: 'G先生｜商家获客实验室', description: '可验证的小红书商家获客服务' }

export default function StoreLayout({ children }) {
  return <div className="store-shell">
    <nav className="store-nav"><Link href="/store" className="store-brand"><b>G.</b><span>商家获客实验室</span></Link><div><Link href="/store">产品</Link><Link href="/store/account">账户与订单</Link></div></nav>
    {children}
    <footer><b>先验证一笔真实付款，再扩大投入。</b><span>服务结果取决于产品、执行和市场，不承诺流量或成交。</span></footer>
  </div>
}
