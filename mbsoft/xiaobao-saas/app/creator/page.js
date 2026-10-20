// 创作者概览页：经营指标、套餐状态、最近订单与快捷入口。
// 只读 Server Component，明细管理拆分到商品/文章/订单/设置子页。

import { SAAS_PRICE_CENTS, fmtDate, now, ordersForTenant, productsForTenant } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import { billingAction } from '@/app/actions/creator'
import Badge from '@/app/components/Badge'
import EmptyState from '@/app/components/EmptyState'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'

export const dynamic = 'force-dynamic'

/** 订单状态文案与色调：已支付 / 待支付 */
const statusOf = (status) =>
  status === 'paid' ? { tone: 'ok', label: '已支付' } : { tone: 'warn', label: '待支付' }

/** 概览页：指标卡 + 套餐状态 + 最近订单前 5 条 + 快捷入口 */
export default function Page() {
  const u = requireRole('creator')
  const products = productsForTenant(u.tenant_id, true)
  const orders = ordersForTenant(u.tenant_id)
  const active = u.period_end > now()
  const salesCents = orders.filter((o) => o.status === 'paid').reduce((n, o) => n + o.amount_cents, 0)

  return (
    <div className="dashboard">
      <PageHeader eyebrow="OVERVIEW" title="概览" description={`欢迎回来，${u.email}`} />

      <section className="metrics">
        <article>
          <b>{products.length}</b>
          <span>商品</span>
        </article>
        <article>
          <b>{orders.length}</b>
          <span>读者订单</span>
        </article>
        <article>
          <b>
            <Money cents={salesCents} />
          </b>
          <span>模拟销售额</span>
        </article>
      </section>

      {active ? (
        <div className="notice">
          <b>
            创作者套餐生效中 <Badge tone="ok">有效至 {fmtDate(u.period_end)}</Badge>
          </b>
          <span>期内可无限发布商品与文章</span>
        </div>
      ) : (
        <form action={billingAction} className="notice">
          <b>
            开通创作者套餐 ¥<Money cents={SAAS_PRICE_CENTS} plain />/月
          </b>
          <span>模拟付款后可发布商品和文章</span>
          <button className="primary" type="submit">
            创建租金订单
          </button>
        </form>
      )}

      <div className="dashGrid">
        <Panel title="快捷入口">
          <div className="quickLinks">
            <a className="primary" href="/creator/articles">
              写文章
            </a>
            <a className="secondary" href="/creator/products">
              发布商品
            </a>
          </div>
        </Panel>
        <Panel
          title="最近订单"
          footer={
            orders.length > 0 ? (
              <a className="secondary" href="/creator/orders">
                查看全部
              </a>
            ) : null
          }
        >
          {orders.length === 0 ? (
            <EmptyState title="还没有订单" description="读者下单并完成模拟支付后，订单会出现在这里。" />
          ) : (
            orders.slice(0, 5).map((o) => {
              const status = statusOf(o.status)
              return (
                <div className="row" key={o.id}>
                  <b>{o.product_name}</b>
                  <span>{o.buyer_email}</span>
                  <span>
                    <Money cents={o.amount_cents} />
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
              )
            })
          )}
        </Panel>
      </div>
    </div>
  )
}
