// 收银台：两种模式——
// 1) 店铺绑定了收款二维码（商品订单）：展示店主二维码，读者扫码直接付款给店主，
//    点「我已完成付款」申报，店主确认收款后发放权益；平台不经手货款。
// 2) 未绑定或月租订单：走平台模拟微信支付（WECHAT_MOCK_ENABLED）。

import { notFound, redirect } from 'next/navigation'
import { mockPayEnabled, ordersForUser, tenantById } from '@/lib'
import { requireUser } from '@/lib/auth/session'
import Money from '@/app/components/Money'
import PayForm from './PayForm'
import ConfirmPayForm from './ConfirmPayForm'

export const dynamic = 'force-dynamic'

/** 收银台页：按订单类型与店铺二维码展示对应支付方式，已支付订单直接跳回 */
export default function CheckoutPage({ params }) {
  const user = requireUser()
  const order = ordersForUser(user.id).find((item) => item.order_no === params.orderNo)
  if (!order) notFound()
  if (order.status === 'paid') redirect(user.role === 'creator' ? '/creator' : '/library')

  // 商品订单 + 店铺已绑定收款二维码 → 自收款模式
  const store = order.kind === 'product' && order.tenant_id ? tenantById(order.tenant_id) : null
  const selfPay = Boolean(store?.pay_qr)

  return (
    <main className="auth">
      <section className="panel checkout">
        {selfPay ? (
          <>
            <span className="mock">扫码付款 · 直接付给创作者</span>
            <h1>扫码支付</h1>
            <p>{order.product_name}</p>
            <strong>
              <Money cents={order.amount_cents} />
            </strong>
            <div className="qr qr--self">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.pay_qr} alt={`${store.name} 收款二维码`} />
            </div>
            <p className="meta">请用微信 / 支付宝扫码，向「{store.name}」支付上方金额</p>
            {order.confirm_requested ? (
              <p className="alert alert--warn">已收到你的付款申报，等待创作者确认收款后即可阅读</p>
            ) : (
              <ConfirmPayForm orderNo={order.order_no} />
            )}
            <small>货款由创作者直接收取，平台不参与资金流转。</small>
          </>
        ) : (
          <>
            <span className="mock">微信支付 · 模拟环境</span>
            <h1>确认支付</h1>
            <p>{order.product_name}</p>
            <strong>
              <Money cents={order.amount_cents} />
            </strong>
            <div className="qr">流程测试</div>
            {mockPayEnabled() ? null : (
              <p className="alert alert--warn">模拟支付未开启，请在启动服务前设置 WECHAT_MOCK_ENABLED=true</p>
            )}
            <PayForm orderNo={order.order_no} disabled={!mockPayEnabled()} />
            <small>不会产生真实扣款或真实收入。</small>
          </>
        )}
      </section>
    </main>
  )
}
