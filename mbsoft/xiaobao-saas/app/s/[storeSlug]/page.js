// 专栏页（读者端）：创作者资料卡 + 标签筛选 + 文章流 + 右侧专栏信息面板。
// 对标小报童 /s/[storeSlug] 专栏首页设计。

import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  tenantBySlug,
  articlesForTenant,
  tagsForTenant,
  storeStats,
  userById,
  fmtDate,
} from '@/lib'
import { currentUser } from '@/lib/auth/session'
import ArticleMenu from '@/app/components/ArticleMenu'
import TagManager from '@/app/components/TagManager'

export const dynamic = 'force-dynamic'

/** 默认头像 SVG（圆形占位） */
function Avatar({ name, size = 48 }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        flexShrink: 0,
      }}
      title={name}
    >
      {initial}
    </div>
  )
}

/** 文章列表中单条 */
function ArticleItem({ article, isOwner }) {
  return (
    <article className="articleItem">
      <Link href={`/read/${article.id}`} className="articleLink">
        <div className="articleMeta">
          <Avatar name={article.author_name} size={32} />
          <span className="articleAuthor">{article.author_name}</span>
          <time className="articleDate">{fmtDate(article.created_at)}</time>
        </div>
        <h3>{article.title}</h3>
        <p className="articleExcerpt">{article.summary}</p>
      </Link>
      {isOwner ? (
        <ArticleMenu
          articleId={article.id}
          articleTitle={article.title}
          editHref={`/creator/articles/${article.id}`}
          sharePath={`/read/${article.id}`}
        />
      ) : null}
    </article>
  )
}

export default function StorePage({ params, searchParams }) {
  const store = tenantBySlug(params.storeSlug)
  if (!store) notFound()

  const articles = articlesForTenant(store.id)
  const tags = tagsForTenant(store.id)
  const stats = storeStats(store.id)
  const owner = userById(store.owner_id)
  const user = currentUser()
  const isOwner = !!(user && user.id === store.owner_id)

  // 标签筛选：URL ?tag=xxx
  const activeTag = searchParams?.tag || ''
  const filtered = activeTag
    ? articles.filter((a) => a.tag === activeTag)
    : articles

  return (
    <main className="storePage">
      {/* ---- 左栏：主内容 ---- */}
      <div className="storeMain">
        {/* 创作者资料卡 */}
        <section className="creatorCard">
          <div className="creatorTop">
            <Avatar name={owner?.name || store.name} size={64} />
            <div className="creatorInfo">
              <h1>{owner?.name || store.name}</h1>
              <div className="creatorStats">
                <div className="stat">
                  <b>{stats.subscribers}</b>
                  <span>订阅者</span>
                </div>
                <div className="stat">
                  <b>{stats.articles}</b>
                  <span>发布内容</span>
                </div>
                <div className="stat">
                  <b>{stats.days}</b>
                  <span>服务天数</span>
                </div>
              </div>
            </div>
          </div>
          <p className="creatorBio">{store.description || '分享可执行、可验证的知识产品。'}</p>
          {owner?.email ? (
            <p className="creatorAbout">
              关于我：{' '}
              <a href={`mailto:${owner.email}`} target="_blank" rel="noreferrer">
                {owner.email}
              </a>
            </p>
          ) : null}
          <div className="inviteBadge">
            👋 本专栏由 @{owner?.name || store.name} 邀请开通
            <span className="badgeArrow">›</span>
          </div>
        </section>

        {/* 标签筛选栏 */}
        <nav className="tagFilter">
          <Link
            href={`/s/${store.slug}`}
            className={`tagPill ${!activeTag ? 'active' : ''}`}
            replace
          >
            全部
          </Link>
          {tags.map((t) => (
            <Link
              key={t.tag}
              href={`/s/${store.slug}?tag=${encodeURIComponent(t.tag)}`}
              className={`tagPill ${activeTag === t.tag ? 'active' : ''}`}
              replace
            >
              #{t.tag} <span className="tagCount">{t.count}</span>
            </Link>
          ))}
        </nav>

        {/* 文章流 */}
        <div className="articleFeed">
          {filtered.length > 0 ? (
            filtered.map((a) => (
              <ArticleItem key={a.id} article={a} isOwner={isOwner} />
            ))
          ) : (
            <div className="emptyFeed">
              {activeTag ? `暂无标签「${activeTag}」下的文章` : '该专栏还没有发布内容'}
            </div>
          )}
        </div>
      </div>

      {/* ---- 右栏：专栏信息面板 ---- */}
      <aside className="storeSidebar">
        <h2 className="sidebarTitle">{store.name}</h2>
        <div className="sidebarSection">
          <span className="sidebarLabel">专栏LOGO</span>
          <div className="sidebarValue">
            <Avatar name={store.name} size={40} />
          </div>
        </div>
        <div className="sidebarSection">
          <span className="sidebarLabel">专栏名称</span>
          <div className="sidebarValue sidebarLink">
            {owner?.name || store.name} <span className="arrow">›</span>
          </div>
        </div>
        <div className="sidebarSection">
          <span className="sidebarLabel">专栏简介</span>
          <Link href={`/s/${store.slug}/about`} className="sidebarValue sidebarLink">
            {(store.description || '暂无简介').slice(0, 40)}
            {store.description && store.description.length > 40 ? '...' : ''}
            <span className="arrow">›</span>
          </Link>
        </div>
        <div className="sidebarSection">
          <span className="sidebarLabel">标签管理</span>
          {isOwner ? (
            <TagManager tags={tags} />
          ) : (
            <div className="sidebarValue sidebarLink">
              <span className="arrow">›</span>
            </div>
          )}
        </div>

        {/* 创作者入口：仅本人可见 */}
        {user && user.tenant_id === store.id ? (
          <div className="ownerEntry">
            <Link href="/creator" className="primary">
              进入管理后台
            </Link>
          </div>
        ) : null}
      </aside>
    </main>
  )
}
