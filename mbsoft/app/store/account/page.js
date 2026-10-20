import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AccountActions from '../AccountActions'
import { getProduct } from '../products'
import { getUserBySession, listOrders } from '../store-db'

export const dynamic = 'force-dynamic'

export default function AccountPage() {
  const token = cookies().get('store_session')?.value
  const user = getUserBySession(token)
  if (!user) redirect('/store/login')
  const orders = listOrders(user.id)
  return <main className="store-main account-page"><section className="account-head"><div><span className="store-kicker">MEMBER CENTER</span><h1>账户与订单</h1><p>{user.email}</p></div><AccountActions/></section><section className="membership-status"><span>月度会员</span><b>{user.membership ? `有效至 ${new Date(user.membership.period_end * 1000).toLocaleDateString('zh-CN')}` : '尚未订阅'}</b><Link href={user.membership ? '/store/learn/monthly-member' : '/store/product/monthly-member'}>{user.membership ? '进入会员内容' : '订阅会员'} →</Link></section><section className="membership-panel"><h2>已购内容</h2>{user.entitlements.length ? <div className="entitlement-list">{user.entitlements.map(item => { const product = getProduct(item.product_slug); return product && <Link key={item.product_slug} href={`/store/learn/${item.product_slug}`}><span>{product.name}</span><b>进入内容 →</b></Link> })}</div> : <div className="empty-state"><b>暂未购买内容</b><p>选择一个最小产品，支付完成后自动出现在这里。</p><Link href="/store">查看产品</Link></div>}</section><section className="membership-panel"><h2>我的订单</h2>{orders.length ? <div className="order-list">{orders.map(order => <Link key={order.order_no} href={order.status === 'paid' ? `/store/payment/success/${order.order_no}` : `/store/checkout/${order.order_no}`}><span><b>{order.product_name}</b><small>{order.order_no}</small></span><span><b>¥{(order.amount_cents / 100).toFixed(2)}</b><small className={`order-status ${order.status}`}>{order.status === 'paid' ? '已支付' : '待支付'}</small></span></Link>)}</div> : <div className="empty-state"><b>还没有订单</b><p>订单创建后会保存在这里。</p></div>}</section></main>
}
