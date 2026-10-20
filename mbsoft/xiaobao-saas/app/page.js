// 首页：hero、平台数据带、精选专栏、两种模式、精选创作者、三步开始与底部 CTA。
// 数据实时读库（adminStats / featuredProducts / discoverStores），因此整页强制动态渲染。

import { SAAS_PRICE_CENTS, adminStats, featuredProducts, discoverStores } from '@/lib'
import { currentUser } from '@/lib/auth/session'
import Money from '@/app/components/Money'
import Badge from '@/app/components/Badge'
import Eyebrow from '@/app/components/Eyebrow'
import EmptyState from '@/app/components/EmptyState'

export const dynamic = 'force-dynamic'

/** 付费模式徽标：买断用柠檬绿强调，订阅用中性色区分 */
const MODE_BADGE = {
  lifetime: { tone: 'lime', label: '一次买断' },
  subscription: { tone: 'muted', label: '按月订阅' },
}

/** 按登录角色给出 hero 主 CTA 的文案与跳转，未登录时引导注册 */
function heroCta(role) {
  if (role === 'creator') return { href: '/creator', label: '进入创作者中心' }
  if (role === 'reader') return { href: '/library', label: '我的内容' }
  if (role === 'admin') return { href: '/admin', label: '平台概览' }
  return { href: '/register?role=creator', label: '注册创作者' }
}

export default function Page() {
  const user = currentUser()
  const cta = heroCta(user && user.role)
  const stats = adminStats()
  const featured = featuredProducts(6)
  const stores = discoverStores(4)

  return (
    <main>
      <section className="hero">
        <div>
          <Eyebrow>KNOWLEDGE COMMERCE</Eyebrow>
          <h1>把你的经验，变成持续销售的知识产品。</h1>
          <p>订阅制、买断制两种模式，内容、订单和读者都在同一个创作者后台。</p>
          <div className="actions">
            <a className="primary" href={cta.href}>
              {cta.label}
            </a>
            <a className="secondary" href="/s/growth-notes">
              查看示例店铺
            </a>
          </div>
        </div>
        <aside>
          <span>创作者月租</span>
          <strong>
            <Money cents={SAAS_PRICE_CENTS} />
            <small>/月</small>
          </strong>
          <ul>
            <li>多个知识商品</li>
            <li>买断与订阅</li>
            <li>订单与读者管理</li>
          </ul>
        </aside>
      </section>

      <section className="statBand">
        <div>
          <b>{stats.tenants}</b>
          <span>创作者</span>
        </div>
        <div>
          <b>{stats.products}</b>
          <span>知识商品</span>
        </div>
        <div>
          <b>{stats.orders}</b>
          <span>读者订单</span>
        </div>
        <div>
          <b>
            <Money cents={stats.paid} />
          </b>
          <span>累计成交</span>
        </div>
      </section>
      <p className="statMeta">本地演示数据</p>

      <section className="featured">
        <div className="sectionHead">
          <div>
            <Eyebrow>FEATURED</Eyebrow>
            <h2>精选专栏</h2>
            <p>
              我们不定期从新加入的创作者中，挑出内容扎实的专栏推荐给你——以此丰富你的信息饮食，也让你认识这些用心的创作者。这里没有算法推荐，只有被认真写过的内容。
            </p>
          </div>
        </div>
        {featured.length ? (
          <div className="featuredGrid">
            {featured.map((item) => {
              const badge = MODE_BADGE[item.mode] || MODE_BADGE.subscription
              return (
                <a className="featuredCard" key={item.id} href={`/s/${item.store_slug}/p/${item.slug}`}>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span>{item.store_name}</span>
                  <span>
                    {item.article_count} 篇内容 · {item.sales} 人已购
                  </span>
                  <strong>
                    <Money cents={item.price_cents} />
                  </strong>
                </a>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title="还没有精选专栏"
            description="等第一批创作者发布商品后，被认真写过的内容会出现在这里。"
          />
        )}
      </section>

      <section className="section">
        <div className="sectionHead">
          <div>
            <Eyebrow>TWO MODES</Eyebrow>
            <h2>两种模式，两种与读者的关系</h2>
          </div>
        </div>
        <div className="modeGrid">
          <article>
            <span>订阅制 · SUBSCRIPTION</span>
            <h3>和读者建立长期联系</h3>
            <p>按月订阅，适合持续更新的专栏。读者每一期都在，作者写得更安心。</p>
          </article>
          <article>
            <span>买断制 · LIFETIME</span>
            <h3>把知识广泛持续传播</h3>
            <p>一次付费，永久拥有，适合沉淀成册的内容。一份心血，被更多人带走。</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead">
          <div>
            <Eyebrow>CREATORS</Eyebrow>
            <h2>精选创作者</h2>
            <p>人们更愿意追随一个活生生的人，而非一个公司。</p>
          </div>
        </div>
        {stores.length ? (
          <div className="featuredGrid">
            {stores.map((store) => (
              <a className="featuredCard" key={store.id} href={`/s/${store.slug}`}>
                <h3>{store.name}</h3>
                <p>{store.description}</p>
                <span>{store.product_count} 个专栏</span>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="还没有精选创作者"
            description="目前还没有店铺发布商品，成为第一个被推荐的创作者吧。"
            actionHref="/register?role=creator"
            actionLabel="开通创作者店铺"
          />
        )}
      </section>

      <section className="steps">
        <article>
          <b>01</b>
          <h2>建立店铺</h2>
          <p>设置名称、简介和独立访问地址。</p>
        </article>
        <article>
          <b>02</b>
          <h2>发布商品</h2>
          <p>组织专栏目录，持续发布付费文章。</p>
        </article>
        <article>
          <b>03</b>
          <h2>完成交付</h2>
          <p>付款后自动开通权益，读者随时阅读。</p>
        </article>
      </section>

      <section className="section">
        <div className="sectionHead">
          <div>
            <Eyebrow>START WRITING</Eyebrow>
            <h2>把你知道的，写给愿意读的人</h2>
            <p>没有算法推荐，也没有广告打扰。订阅制帮你留住读者，买断制让内容走得更远。</p>
          </div>
          <a className="primary" href="/register?role=creator">
            开通创作者店铺
          </a>
        </div>
      </section>
    </main>
  )
}
