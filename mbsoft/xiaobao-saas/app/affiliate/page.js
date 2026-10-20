// 分销中心：所有登录用户可用。展示钱包余额、可推广商品（含二维码）、佣金明细与提现记录。
// 推广链接经 ?ref= 下单，支付成功后按店铺设置的佣金比例记一笔待结算佣金并进入钱包。

import { headers } from 'next/headers'
import {
  WITHDRAW_TAX_RATE,
  commissionsFor,
  fmtDate,
  myReferralCode,
  promotableProducts,
  wallet,
  withdrawalsFor,
} from '@/lib'
import { requireUser } from '@/lib/auth/session'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'
import EmptyState from '@/app/components/EmptyState'
import CopyLink from '@/app/components/CopyLink'
import QrCode from '@/app/components/QrCode'
import WithdrawForm from '@/app/components/WithdrawForm'

export const dynamic = 'force-dynamic'

/** 分销中心：钱包 + 推广二维码 + 佣金明细 + 提现记录 */
export default function AffiliatePage() {
  const user = requireUser()
  const code = myReferralCode(user.id)
  const host = headers().get('host') || 'localhost:3000'
  const siteUrl = `http://${host}/?ref=${code}`
  const products = promotableProducts(9)
  const list = commissionsFor(user.id)
  const w = wallet(user.id)
  const withdrawals = withdrawalsFor(user.id)

  return (
    <main className="dashboard">
      <PageHeader
        eyebrow="AFFILIATE"
        title="分销中心"
        description="把带推广码的链接或二维码分享出去，读者经链接完成购买后，作者设置的佣金比例会计入你的钱包。"
      />

      <section className="metrics">
        <article>
          <b>
            <Money cents={w.availableCents} />
          </b>
          <span>可提现佣金</span>
        </article>
        <article>
          <b>
            <Money cents={w.pendingCents} />
          </b>
          <span>待结算佣金</span>
        </article>
        <article>
          <b>
            <Money cents={w.withdrawnCents} />
          </b>
          <span>累计已提现</span>
        </article>
      </section>

      <div className="dashGrid">
        <Panel title="我的推广码">
          <div className="affiliateCode">
            <b>{code}</b>
            <CopyLink text={siteUrl} label="复制推广链接" />
          </div>
          <p className="meta">站点推广链接：{siteUrl}</p>
          <QrCode text={siteUrl} size={132} className="qrBox qrCenter" />
          <p className="meta">保存二维码分享到朋友圈或社群，他人扫码进入即带有你的推广标识。</p>
        </Panel>

        <Panel title="钱包 · 提现">
          {w.availableCents > 0 ? (
            <WithdrawForm availableYuan={w.availableCents / 100} taxRate={WITHDRAW_TAX_RATE} />
          ) : (
            <EmptyState
              title="暂无可提现佣金"
              description="分享推广链接，他人完成购买后佣金进入钱包，即可在此申请提现。"
            />
          )}
        </Panel>
      </div>

      <Panel title="可推广商品" className="wide">
        {products.length ? (
          <div className="affiliateGrid">
            {products.map((p) => {
              const url = `http://${host}/s/${p.store_slug}/p/${p.slug}?ref=${code}`
              const rate = p.partner_enabled ? Math.round(Number(p.commission_rate) * 100) : 0
              return (
                <div className="affiliateCard" key={p.id}>
                  <b>{p.name}</b>
                  <span className="meta">{p.store_name}</span>
                  <span>
                    <Money cents={p.price_cents} />
                    <i className="meta"> · 已售 {p.sales}</i>
                  </span>
                  {rate > 0 ? (
                    <span className="rateTag">佣金 {rate}%</span>
                  ) : (
                    <span className="rateTag muted">未开启合伙人</span>
                  )}
                  <QrCode text={url} size={104} className="qrBox qrCard" />
                  <CopyLink text={url} label="复制推广链接" className="affiliateCopy" />
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="暂无可推广商品" description="等创作者发布商品后，这里会出现可分享的推广链接。" />
        )}
      </Panel>

      <Panel title="佣金明细" className="wide">
        {list.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>商品</th>
                <th>订单金额</th>
                <th>佣金</th>
                <th>状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.order_no}</td>
                  <td>
                    <b>{c.product_name}</b>
                  </td>
                  <td>
                    <Money cents={c.order_amount_cents} />
                  </td>
                  <td>
                    <Money cents={c.amount_cents} />
                  </td>
                  <td>{c.status === 'settled' ? '已结算' : '待结算'}</td>
                  <td>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="还没有佣金记录"
            description="分享推广链接，他人经链接完成购买后，佣金会记录在这里。"
          />
        )}
      </Panel>

      <Panel title="提现记录" className="wide">
        {withdrawals.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>提现金额</th>
                <th>税费</th>
                <th>到账</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((wd) => (
                <tr key={wd.id}>
                  <td>
                    <Money cents={wd.amount_cents} />
                  </td>
                  <td>
                    <Money cents={wd.tax_cents} />
                  </td>
                  <td>
                    <b>
                      <Money cents={wd.net_cents} />
                    </b>
                  </td>
                  <td>{fmtDate(wd.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="还没有提现记录" description="钱包有可提现余额后，可在此申请提现。" />
        )}
      </Panel>
    </main>
  )
}
