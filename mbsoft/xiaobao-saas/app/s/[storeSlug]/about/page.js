// 专栏介绍页（关于我）：渲染店铺的 Markdown 介绍，未填写时回退到一句话简介。

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { tenantBySlug, userById, storeStats } from '@/lib'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

/** 介绍页：/s/[storeSlug]/about，从专栏页「关于我」进入 */
export default function AboutPage({ params }) {
  const store = tenantBySlug(params.storeSlug)
  if (!store) notFound()

  const owner = userById(store.owner_id)
  const stats = storeStats(store.id)
  const body = (store.intro || '').trim() || store.description || '这位创作者还没有填写介绍。'

  return (
    <main className="aboutPage">
      <section className="panel aboutPanel">
        <div className="aboutHeader">
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 26, flexShrink: 0 }}>
            {(owner?.name || store.name || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1>{owner?.name || store.name}</h1>
            <p className="aboutStats meta">
              {stats.subscribers} 订阅者 · {stats.articles} 篇内容 · 服务 {stats.days} 天
            </p>
          </div>
        </div>
        <article className="aboutBody" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        <Link href={`/s/${store.slug}`} className="secondary">
          ← 返回专栏
        </Link>
      </section>
    </main>
  )
}
