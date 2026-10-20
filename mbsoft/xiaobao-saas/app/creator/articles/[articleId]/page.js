// 编辑文章页：校验文章归属后渲染预填的编辑表单（Markdown 编辑器）。
// 文章不存在或不属于当前创作者的店铺时一律 404。

import { notFound } from 'next/navigation'
import { articleById } from '@/lib'
import { requireRole } from '@/lib/auth/session'
import PageHeader from '@/app/components/PageHeader'
import Panel from '@/app/components/Panel'
import ArticleForm from '../../ArticleForm'

export const dynamic = 'force-dynamic'

/** 编辑文章：仅本店铺内的文章可见，成功后由 action 跳回文章列表 */
export default async function Page({ params }) {
  const u = requireRole('creator')
  const article = articleById(Number(params.articleId))
  if (!article || article.tenant_id !== u.tenant_id) notFound()

  return (
    <div className="dashboard">
      <PageHeader
        eyebrow="EDIT ARTICLE"
        title="编辑文章"
        description={`所属商品：${article.product_name}`}
      />
      <Panel title="文章内容" className="wide">
        <ArticleForm
          articleId={article.id}
          productName={article.product_name}
          initial={{ title: article.title, summary: article.summary, body: article.body, tag: article.tag }}
        />
      </Panel>
    </div>
  )
}
