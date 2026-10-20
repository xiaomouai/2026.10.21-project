import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getProduct } from '../../products'
import { getUserBySession } from '../../store-db'

export const dynamic = 'force-dynamic'

export default function LearnPage({ params }) {
  const product = getProduct(params.slug)
  if (!product) notFound()
  const token = cookies().get('store_session')?.value
  if (!token) redirect('/store/login')
  const user = getUserBySession(token)
  if (!user) redirect('/store/login')
  const unlocked = product.slug === 'monthly-member' ? Boolean(user.membership) : user.entitlements.some(item => item.product_slug === product.slug)
  if (!unlocked) return <main className="store-main locked-page"><span className="store-kicker">MEMBERS ONLY</span><h1>该内容尚未解锁</h1><p>{product.preview}</p><Link className="store-primary" href={`/store/product/${product.slug}`}>查看购买方式</Link></main>
  return <main className="store-main learn-page"><Link href="/store/account" className="back-link">← 返回会员中心</Link><span className="store-kicker">UNLOCKED</span><h1>{product.name}</h1><article><p>{product.content}</p><h2>下一步</h2><p>保存购买凭证和当前业务数据，按购买平台约定提交材料。所有结果以真实交付记录为准。</p></article></main>
}
