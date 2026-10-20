// 分享卡片公开页：无需登录即可查看文章预览，引导购买或回读全文。
// 通过 generateMetadata 输出标题与摘要，便于社交平台链接预览。

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { articleById, canRead, productById, tenantById, fmtDate } from '@/lib'
import { excerptOf } from '@/lib/markdown'
import { currentUser } from '@/lib/auth/session'
import Eyebrow from '@/app/components/Eyebrow'
import Badge from '@/app/components/Badge'
import Money from '@/app/components/Money'
import CopyLink from '@/app/components/CopyLink'

export const dynamic = 'force-dynamic'

/** 组装分享页数据：文章不存在、商品缺失、商品或文章未发布时返回 null */
function loadShare(articleId) {
  const article = articleById(articleId)
  if (!article || article.status !== 'published') return null
  const product = productById(article.product_id)
  if (!product || product.status !== 'published') return null
  const store = tenantById(product.tenant_id)
  if (!store) return null
  return { article, product, store, buyHref: `/s/${store.slug}/p/${product.slug}` }
}

/** 社交平台链接预览：标题用文章标题，描述用正文摘要；草稿不产出预览 */
export async function generateMetadata({ params }) {
  const article = articleById(Number(params.articleId))
  if (!article || article.status !== 'published') return { title: '内容不存在 · 知栈' }
  return { title: article.title, description: excerptOf(article.body, 120) }
}

export default function SharePage({ params }) {
  const data = loadShare(Number(params.articleId))
  if (!data) notFound()
  const { article, product, buyHref } = data

  const host = headers().get('host') || 'localhost:3000'
  const shareUrl = `http://${host}/share/${article.id}`
  const user = currentUser()
  const owned = Boolean(user && canRead(user.id, product.id))

  return (
    <main className="sharePage">
      <section className="shareCard">
        <Eyebrow>{`${data.store.name} · ${product.name}`}</Eyebrow>
        <h1>{article.title}</h1>
        <div className="shareMeta">
          <Badge tone="muted">{article.tag}</Badge>
          <span>{fmtDate(article.created_at)}</span>
        </div>
        <p className="shareExcerpt">{excerptOf(article.body, 280)}</p>
        <div className="shareLock">
          <b>···</b>
          <p>这篇文章还有更多内容，购买《{product.name}》后可阅读全文</p>
        </div>
        <div className="actions">
          {owned ? (
            <a className="primary" href={`/read/${article.id}`}>
              你已购买，去阅读全文
            </a>
          ) : (
            <a className="primary" href={buyHref}>
              <Money cents={product.price_cents} /> 购买阅读全文
            </a>
          )}
          <CopyLink text={shareUrl} label="复制分享卡片链接" />
        </div>
        <small className="shareNote">由知栈创作者发布 · 模拟环境</small>
      </section>
    </main>
  )
}
