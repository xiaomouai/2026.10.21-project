import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct, getProducts } from '../../products'
import PurchaseButton from '../../PurchaseButton'

export function generateStaticParams() { return getProducts().map(product => ({ slug: product.slug })) }

export default function ProductPage({ params }) {
  const product = getProduct(params.slug)
  if (!product) notFound()
  return <main className="store-main product-page"><Link href="/store" className="back-link">← 返回全部产品</Link><section className="product-hero"><div><span className="store-kicker">{product.eyebrow}</span><h1>{product.name}</h1><p>{product.summary}</p><div className="product-price large"><small>¥</small>{product.price}</div></div><aside><h2>这次你会拿到</h2><ul>{product.deliverables.map(item => <li key={item}>✓ {item}</li>)}</ul><PurchaseButton productSlug={product.slug}/><small>当前为模拟微信支付，用于验证购买、订单和权益流程，不产生真实扣款。</small></aside></section><section className="product-copy"><article><span>适合谁</span><p>{product.audience}</p></article><article><span>免费试看</span><p>{product.preview}</p></article></section><section className="unlock-banner"><div><span>AFTER PURCHASE</span><h2>付款后自动获取内容</h2></div><Link href="/store/account" className="store-secondary">查看我的订单</Link></section></main>
}
