// 订单列表页：店铺收到的全部商品订单，含买家、金额、状态与分销标识。
// 自收款流程中，读者申报付款的订单（待确认）在此确认收款后发放权益。
// ref_code 为分销推广码来源，可能不存在或为 null，展示时需兼容。

import { fmtDate, ordersForTenant } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import { confirmPaymentAction } from '@/app/actions/creator'
import Badge from '@/app/components/Badge'
import EmptyState from '@/app/components/EmptyState'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'

export const dynamic = 'force-dynamic'

/** 订单状态文案与色调：已支付 / 待确认（读者申报付款）/ 待支付 */
function statusOf(order) {
  if (order.status === 'paid') return { tone: 'ok', label: '已支付' }
  if (order.confirm_requested) return { tone: 'warn', label: '待确认收款' }
  return { tone: 'muted', label: '待支付' }
}

/** 订单页：按时间倒序展示全部商品订单 */
export default function Page() {
  const u = requireRole('creator')
  const orders = ordersForTenant(u.tenant_id)

  return (
    <div className="dashboard">
      <PageHeader
        eyebrow="ORDERS"
        title="订单"
        description="读者扫码付款并申报后，在这里确认收款并发放权益"
      />

      <Panel title="全部订单" className="wide">
        {orders.length === 0 ? (
          <EmptyState title="还没有订单" description="把商品分享给读者，第一笔订单很快就会到来。" />
        ) : (
          orders.map((o) => {
            const status = statusOf(o)
            return (
              <div className="row" key={o.id}>
                <b>{o.product_name}</b>
                <span>
                  {o.buyer_email} · {fmtDate(o.created_at)}
                </span>
                <span>
                  <Money cents={o.amount_cents} />
                </span>
                <span className="rowBadges">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {o.ref_code ? <Badge tone="lime">分销</Badge> : null}
                </span>
                {o.status === 'pending' && o.confirm_requested ? (
                  <form action={confirmPaymentAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <button type="submit" className="secondary">
                      确认收款
                    </button>
                  </form>
                ) : null}
              </div>
            )
          })
        )}
      </Panel>
    </div>
  )
}
