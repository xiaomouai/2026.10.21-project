// 商品管理页：商品列表（模式 / 价格 / 文章数 / 标识）+ 新建商品表单。

import { articlesForProduct, productsForTenant } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import EmptyState from '@/app/components/EmptyState'
import Money from '@/app/components/Money'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'
import Badge from '@/app/components/Badge'
import ProductForm from '../ProductForm'

export const dynamic = 'force-dynamic'

/** 商品页：左侧商品清单，右侧新建表单 */
export default function Page() {
  const u = requireRole('creator')
  const products = productsForTenant(u.tenant_id, true)

  return (
    <div className="dashboard">
      <PageHeader eyebrow="PRODUCTS" title="商品" description="管理你的付费专栏与课程" />

      <Panel title="商品列表" className="wide">
        {products.length === 0 ? (
          <EmptyState
            title="还没有商品"
            description="在下方「新建商品」发布第一个商品，再往里添加付费文章。"
          />
        ) : (
          products.map((p) => (
            <div className="row" key={p.id}>
              <b>{p.name}</b>
              <span>
                <Money cents={p.price_cents} />
              </span>
              <Badge tone={p.mode === 'lifetime' ? 'lime' : 'muted'}>
                {p.mode === 'lifetime' ? '买断' : '订阅'}
              </Badge>
              <span className="meta">
                {articlesForProduct(p.id, true).length} 篇 · /{p.slug}
              </span>
            </div>
          ))
        )}
      </Panel>

      <Panel title="新建商品" className="wide">
        <ProductForm />
      </Panel>
    </div>
  )
}
