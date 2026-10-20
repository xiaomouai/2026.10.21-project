// 商品详情页：左侧是商品介绍与文章目录，右侧是价格与购买卡。

import { notFound } from 'next/navigation'
import { articlesForProduct, productBySlug, tenantBySlug } from '@/lib'
import { currentUser } from '@/lib/auth/session'
import Eyebrow from '@/app/components/Eyebrow'
import Money from '@/app/components/Money'
import BuyForm from './BuyForm'

export const dynamic = 'force-dynamic'

/** 商品详情页：展示商品介绍、文章目录，并提供模拟支付的购买入口；支持 ?ref= 推广码 */
export default function ProductPage({ params, searchParams }) {
  const store = tenantBySlug(params.storeSlug)
  if (!store) notFound()
  const product = productBySlug(store.id, params.productSlug)
  if (!product) notFound()
  const articles = articlesForProduct(product.id)
  const user = currentUser()
  const lifetime = product.mode === 'lifetime'
  const ref = searchParams?.ref || ''
  const partnerRate = store.partner_enabled ? Math.round(Number(store.commission_rate) * 100) : 0

  return (
    <main>
      <section className="detail">
        <div>
          <a href={`/s/${store.slug}`}>← {store.name}</a>
          <Eyebrow>{lifetime ? '一次买断' : '按月订阅'}</Eyebrow>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <p>
            <b>适合：</b>
            {product.audience}
          </p>
          <ol>
            {articles.map((article) => (
              <li key={article.id}>
                <b>{article.title}</b>
                <span>{article.summary}</span>
              </li>
            ))}
          </ol>
        </div>
        <aside>
          <strong>
            <Money cents={product.price_cents} />
          </strong>
          <small>{lifetime ? '永久阅读' : '30天访问'}</small>
          <BuyForm productId={product.id} refCode={ref} />
          {ref && partnerRate > 0 ? (
            <p className="meta">你通过推广链接访问，购买后推广者将获得 {partnerRate}% 佣金</p>
          ) : null}
          {user ? null : <p className="meta">购买需要登录读者账户</p>}
          <p>模拟微信支付，不产生真实扣款。</p>
        </aside>
      </section>
    </main>
  )
}
