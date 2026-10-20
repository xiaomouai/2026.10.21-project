// 文章阅读页：有权益时用 Markdown 渲染正文，无权益时渲染带购买入口的付费墙。
// 草稿文章不对外：仅专栏 owner 可以预览，其他人一律 404。

import { notFound } from 'next/navigation'
import { articleById, canRead, productById, tenantById } from '@/lib'
import { renderMarkdown, excerptOf } from '@/lib/markdown'
import { requireUser } from '@/lib/auth/session'
import Eyebrow from '@/app/components/Eyebrow'
import ShareButton from '@/app/components/ShareButton'

export const dynamic = 'force-dynamic'

/** 文章阅读页：按文章 id 渲染正文，或在没有权益时渲染付费墙 */
export default function ReadPage({ params }) {
  const user = requireUser()
  const article = articleById(Number(params.articleId))
  if (!article) notFound()

  // 草稿守卫：仅专栏主本人可预览草稿，读者与游客一律 404
  const isStoreOwner = user.role === 'creator' && user.tenant_id === article.tenant_id
  if (article.status === 'draft' && !isStoreOwner) notFound()

  if (!canRead(user.id, article.product_id)) {
    const product = productById(article.product_id)
    const store = tenantById(article.tenant_id)
    const buyHref = product && store ? `/s/${store.slug}/p/${product.slug}` : '/'

    return (
      <main className="reader">
        <section className="panel">
          <Eyebrow>付费内容</Eyebrow>
          <h1>{article.title}</h1>
          <p className="lead">{article.summary}</p>
          <p>该内容属于《{article.product_name}》，购买后即可阅读全文。</p>
          <blockquote className="paywallPreview">{excerptOf(article.body, 200)}</blockquote>
          <div className="actions">
            <a className="primary" href={buyHref}>
              购买《{article.product_name}》
            </a>
            <a className="secondary" href="/library">
              我的内容
            </a>
            <a className="secondary" href="/">
              去发现
            </a>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="reader">
      <Eyebrow>
        {[article.status === 'draft' ? '草稿预览' : article.product_name, article.tag]
          .filter(Boolean)
          .join(' · ')}
      </Eyebrow>
      <h1>{article.title}</h1>
      <p className="lead">{article.summary}</p>
      <div className="readerOps">
        <ShareButton title={article.title} path={`/read/${article.id}`} label="分享文章" />
      </div>
      <article dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }} />
      <a href="/library">← 返回我的内容</a>
    </main>
  )
}
