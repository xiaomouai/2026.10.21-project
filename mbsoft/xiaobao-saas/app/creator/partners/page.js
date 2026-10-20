// 合伙人计划榜单：展示各推广者带来的读者数与销售金额，支持时段筛选。
// 数据来自 orders 按推广码聚合，自购（推广者本人下单）不计入。

import { PARTNER_MAX_PERCENT, partnerLeaderboard, partnerSettings } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import Badge from '@/app/components/Badge'
import EmptyState from '@/app/components/EmptyState'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'

export const dynamic = 'force-dynamic'

/** 时段选项：value 与 leaderboard 的 range 入参对应 */
const RANGES = [
  { value: 'all', label: '全部' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
]

/** 合伙人榜单页：排行表 + 时段切换 */
export default function Page({ searchParams }) {
  const u = requireRole('creator')
  const range = RANGES.some((r) => r.value === searchParams?.range) ? searchParams.range : 'all'
  const partner = partnerSettings(u.tenant_id)
  const rows = partnerLeaderboard(u.tenant_id, range)

  const totalSales = rows.reduce((n, r) => n + r.sales_cents, 0)
  const totalBuyers = rows.reduce((n, r) => n + r.buyers, 0)

  return (
    <div className="dashboard">
      <PageHeader
        eyebrow="PARTNERS"
        title="合伙人计划"
        description={
          partner.enabled
            ? `已开启，佣金比例 ${partner.ratePercent}%。查看推广者带来的读者与销售。`
            : `尚未开启。在「店铺设置」中开启合伙人计划并设置佣金比例（最高 ${PARTNER_MAX_PERCENT}%）后即可查看榜单。`
        }
      />

      <section className="metrics">
        <article>
          <b>{rows.length}</b>
          <span>推广者</span>
        </article>
        <article>
          <b>{totalBuyers}</b>
          <span>带来读者</span>
        </article>
        <article>
          <b>
            <Money cents={totalSales} />
          </b>
          <span>推广销售额</span>
        </article>
      </section>

      <Panel title="合伙人排行" className="wide">
        <form className="rangeBar" method="get">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="submit"
              name="range"
              value={r.value}
              className={range === r.value ? 'chip active' : 'chip'}
            >
              {r.label}
            </button>
          ))}
        </form>

        {rows.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>排名</th>
                <th>推广者</th>
                <th>推广码</th>
                <th>带来读者</th>
                <th>订单数</th>
                <th>销售金额</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.code}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{r.referrer_email}</b>
                  </td>
                  <td>
                    <Badge tone="lime">{r.code}</Badge>
                  </td>
                  <td>{r.buyers}</td>
                  <td>{r.orders_count}</td>
                  <td>
                    <Money cents={r.sales_cents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="还没有推广者"
            description="把你的专栏分享出去，读者生成专属推广链接并完成购买后，会出现在这份榜单里。"
          />
        )}
        <p className="meta" style={{ marginTop: '14px' }}>
          榜单按销售金额排序；统计范围：{RANGES.find((r) => r.value === range)?.label}。自购不计入推广业绩。
        </p>
      </Panel>
    </div>
  )
}
