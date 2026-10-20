// 文章管理页：新建文章（Markdown 编辑器）+ 按商品分组的文章清单。
// 每篇文章提供「分享卡片」与「编辑」入口；草稿文章标注状态且不提供分享入口。

import { articlesForProduct, fmtDate, productsForTenant } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import Badge from '@/app/components/Badge'
import EmptyState from '@/app/components/EmptyState'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'
import ArticleForm from '../ArticleForm'

export const dynamic = 'force-dynamic'

/** 文章页：新建表单在上，已发布文章按商品分组列在下方 */
export default function Page() {
  const u = requireRole('creator')
  const products = productsForTenant(u.tenant_id, true)

  return (
    <div className="dashboard">
      <PageHeader eyebrow="ARTICLES" title="文章" description="用 Markdown 写作，实时预览阅读效果" />

      <Panel title="新建文章" className="wide">
        <ArticleForm products={products.map((p) => ({ value: p.id, label: p.name }))} />
      </Panel>

      <Panel title="已发布文章" className="wide">
        {products.length === 0 ? (
          <EmptyState title="还没有商品" description="先到「商品」页发布一个商品，才能往里写文章。" />
        ) : (
          products.map((p) => {
            const articles = articlesForProduct(p.id, true)
            if (articles.length === 0) return null
            return (
              <article className="manage" key={p.id}>
                <div>
                  <b>{p.name}</b>
                  <span>{articles.length} 篇文章</span>
                </div>
                <div className="stack">
                  {articles.map((a) => (
                    <div className="row" key={a.id}>
                      <b>{a.title}</b>
                      {a.status === 'draft' ? <Badge tone="warn">草稿</Badge> : null}
                      <span>{a.tag}</span>
                      <span className="meta">{fmtDate(a.created_at)}</span>
                      <div className="rowActions">
                        {a.status === 'published' ? (
                          <a className="secondary" href={`/share/${a.id}`}>
                            分享卡片
                          </a>
                        ) : null}
                        <a className="secondary" href={`/creator/articles/${a.id}`}>
                          编辑
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )
          })
        )}
      </Panel>
    </div>
  )
}
