import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getOrder, getUserBySession } from '../../../store-db'

export const dynamic = 'force-dynamic'

export default function PaymentSuccessPage({ params }) {
  const user = getUserBySession(cookies().get('store_session')?.value)
  if (!user) redirect('/store/login')
  let order
  try { order = getOrder(user.id, params.orderNo) } catch { notFound() }
  if (order.status !== 'paid') redirect(`/store/checkout/${order.order_no}`)
  const target = order.product_slug === 'monthly-member' ? '/store/account' : `/store/learn/${order.product_slug}`
  return <main className="store-main success-page"><section><div className="success-mark">✓</div><span className="store-kicker">PAYMENT COMPLETE · MOCK</span><h1>模拟支付成功</h1><p>订单已记录，权益已经自动开通。</p><dl><div><dt>订单号</dt><dd>{order.order_no}</dd></div><div><dt>商品</dt><dd>{order.product_name}</dd></div><div><dt>金额</dt><dd>¥{(order.amount_cents / 100).toFixed(2)}</dd></div></dl><div className="store-actions"><Link className="store-primary" href={target}>{order.product_slug === 'monthly-member' ? '查看会员状态' : '进入已购内容'}</Link><Link className="store-secondary" href="/store/account">查看全部订单</Link></div><small>这是本地模拟支付结果，不代表真实微信付款或营业收入。</small></section></main>
}
