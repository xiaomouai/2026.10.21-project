import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import MockPayButton from '../../MockPayButton'
import { getOrder, getUserBySession } from '../../store-db'

export const dynamic = 'force-dynamic'

export default function CheckoutPage({ params }) {
  const user = getUserBySession(cookies().get('store_session')?.value)
  if (!user) redirect(`/store/login?returnTo=${encodeURIComponent(`/store/checkout/${params.orderNo}`)}`)
  let order
  try { order = getOrder(user.id, params.orderNo) } catch { notFound() }
  if (order.status === 'paid') redirect(`/store/payment/success/${order.order_no}`)
  return <main className="store-main checkout-page"><Link href={`/store/product/${order.product_slug}`} className="back-link">← 返回商品</Link><section className="checkout-card"><div className="mock-badge">微信支付 · 模拟环境</div><h1>确认支付</h1><p>{order.product_name}</p><div className="checkout-amount"><small>应付金额</small><b>¥{(order.amount_cents / 100).toFixed(2)}</b></div><div className="mock-qr" aria-label="模拟微信支付二维码"><span>仅供流程测试</span></div><MockPayButton orderNo={order.order_no}/><small>不会唤起微信，也不会产生真实扣款。正式接入后此页将展示真实微信支付二维码或跳转微信收银台。</small></section></main>
}
