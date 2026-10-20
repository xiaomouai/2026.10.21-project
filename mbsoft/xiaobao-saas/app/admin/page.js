// 平台概览页：管理员视角的四项核心指标与创作者店铺列表。
// 统计实时读库，整页强制动态渲染；仅 admin 角色可访问。

import { adminStats, discoverStores } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'
import EmptyState from '@/app/components/EmptyState'

export const dynamic = 'force-dynamic'

export default function Page() {
  requireRole('admin')
  const stats = adminStats()
  const stores = discoverStores(20)

  return (
    <main className="dashboard">
      <PageHeader
        eyebrow="PLATFORM ADMIN"
        title="平台概览"
        description="创作者店铺、知识商品与读者订单的整体情况。"
      />

      <section className="metrics">
        <article>
          <b>{stats.tenants}</b>
          <span>创作者</span>
        </article>
        <article>
          <b>{stats.products}</b>
          <span>商品</span>
        </article>
        <article>
          <b>{stats.orders}</b>
          <span>读者订单</span>
        </article>
        <article>
          <b>
            <Money cents={stats.paid} />
          </b>
          <span>模拟交易额</span>
        </article>
      </section>

      <Panel title="创作者店铺" className="wide">
        {stores.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>店铺</th>
                <th>标识</th>
                <th>已发布商品</th>
                <th>访问</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id}>
                  <td>
                    <b>{store.name}</b>
                  </td>
                  <td>{store.slug}</td>
                  <td>{store.product_count}</td>
                  <td>
                    <a href={`/s/${store.slug}`}>进入店铺</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="还没有创作者店铺" description="等第一个创作者开通店铺后，这里会列出全部店铺。" />
        )}
      </Panel>

      <p>所有数据均来自本地模拟流程，不代表真实收入。</p>
    </main>
  )
}
