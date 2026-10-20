// 店铺设置页：店铺资料表单 + 合伙人计划开关 + 分销佣金说明。
// 资料保存走 saveStoreAction，合伙人设置走 updatePartnerAction，成功后回到本页。

import { PARTNER_MAX_PERCENT, partnerSettings, tenantById } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'
import StoreForm from '../StoreForm'
import PartnerForm from '../PartnerForm'
import QrUploadForm from '../QrUploadForm'

export const dynamic = 'force-dynamic'

/** 设置页：店铺资料 + 合伙人计划 + 分销玩法说明 */
export default function Page() {
  const u = requireRole('creator')
  const tenant = tenantById(u.tenant_id)
  const partner = partnerSettings(u.tenant_id)

  return (
    <div className="dashboard">
      <PageHeader eyebrow="SETTINGS" title="店铺设置" description="店铺名即读者看到的品牌名" />

      <div className="dashGrid">
        <Panel title="店铺资料">
          <StoreForm
            tenant={{
              name: u.tenant_name,
              slug: u.tenant_slug,
              description: tenant?.description || '分享可执行、可验证的知识产品。',
              intro: tenant?.intro || '',
            }}
          />
        </Panel>
        <Panel title="收款二维码">
          <QrUploadForm payQr={tenant?.pay_qr || ''} />
        </Panel>
        <Panel title="合伙人计划">
          <PartnerForm
            enabled={partner.enabled}
            ratePercent={partner.ratePercent}
            maxPercent={PARTNER_MAX_PERCENT}
          />
        </Panel>
      </div>

      <Panel title="收款说明" className="wide">
        <p className="meta">
          绑定你的微信 / 支付宝收款二维码后，读者购买时扫码直接向你付款，货款不经平台；
          读者付款后点击「我已完成付款」，你在「订单」页确认收款，系统随即发放阅读权益并计算分销佣金。
          平台只按 ¥99/月 收取创作工具使用费，与你的商品货款无关。
        </p>
      </Panel>

      <Panel title="分销推广" className="wide">
        <p className="meta">
          每笔通过合伙人专属链接成交的订单，都会被标记为「分销」并按你设置的佣金比例计入合伙人佣金；
          在「订单」页可以看到哪些订单来自分销推广，在「合伙人」页可以查看推广者带来的读者与销售排行。
        </p>
      </Panel>
    </div>
  )
}
