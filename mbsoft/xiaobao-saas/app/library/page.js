// 我的内容：读者的已购内容列表与全部订单记录。

import { articlesForProduct, fmtDate, library, ordersForUser } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import { logoutAction } from '@/app/actions/auth'
import Badge from '@/app/components/Badge'
import EmptyState from '@/app/components/EmptyState'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'

export const dynamic = 'force-dynamic'

/** 我的内容页：展示读者的已购内容与订单，待支付订单可继续支付 */
export default function LibraryPage() {
  const user = requireRole('reader')
  const items = library(user.id)
  const orders = ordersForUser(user.id)

  return (
    <main className="dashboard">
      <PageHeader eyebrow="MY LIBRARY" title="我的内容" description={user.email}>
        <form action={logoutAction}>
          <button className="secondary">退出</button>
        </form>
      </PageHeader>
      {items.length ? (
        <section className="catalog">
          {items.map((item) => (
            <article className="product" key={item.id}>
              <span>{item.store_name}</span>
              <h2>{item.name}</h2>
              <p>
                {item.expires_at ? (
                  <Badge tone="warn">{`订阅 · 有效至 ${fmtDate(item.expires_at)}`}</Badge>
                ) : (
                  <Badge tone="muted">永久有效</Badge>
                )}
              </p>
              {articlesForProduct(item.product_id).map((article) => (
                <a key={article.id} href={`/read/${article.id}`}>
                  {article.title} →
                </a>
              ))}
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="还没有已购内容" description="去发现页看看精选专栏" actionHref="/" actionLabel="去发现" />
      )}
      <Panel title="订单">
        {orders.length ? (
          orders.map((order) => (
            <div className="row" key={order.id}>
              <b>{order.product_name}</b>
              <span>{order.order_no}</span>
              <span>
                <Money cents={order.amount_cents} />
              </span>
              <span>
                {order.status === 'paid' ? <Badge tone="ok">已支付</Badge> : <Badge tone="warn">待支付</Badge>}
                {order.status === 'paid' ? null : <a href={`/checkout/${order.order_no}`}> 继续支付</a>}
              </span>
            </div>
          ))
        ) : (
          <p className="meta">还没有订单记录</p>
        )}
      </Panel>
    </main>
  )
}
