import Link from 'next/link'
import { getProducts } from './products'

export default function StoreHome() {
  const products = getProducts()
  return <main className="store-main">
    <section className="store-hero"><span className="store-kicker">FOR LOCAL BUSINESS · XI'AN</span><h1>不卖运营玄学。<br/>只交付可检查的增长动作。</h1><p>从一次99元诊断开始。注册、购买、查看订单和获取内容都在这里完成。</p><div className="store-actions"><a href="#products" className="store-primary">查看产品</a><Link href="/store/account" className="store-secondary">我的订单</Link></div><div className="proof-strip"><span><b>24h</b> 最快交付</span><span><b>4项</b> 明码标价</span><span><b>0</b> 虚假承诺</span></div></section>
    <section className="store-section" id="products"><div className="section-heading"><span>PRODUCTS</span><h2>先买最小结果</h2><p>每个产品都写清价格、交付和边界。</p></div><div className="product-grid">{products.map((product, index) => <article className="product-card" key={product.slug}><div className="product-number">0{index + 1}</div><span className="product-eyebrow">{product.eyebrow}</span><h3>{product.name}</h3><p>{product.summary}</p><div className="product-price"><small>¥</small>{product.price}</div><Link href={`/store/product/${product.slug}`}>查看交付详情 <span>→</span></Link></article>)}</div></section>
    <section className="store-process"><div><span>HOW IT WORKS</span><h2>四步完成购买与交付</h2></div><ol><li><b>01</b><span>选择产品</span></li><li><b>02</b><span>注册或登录</span></li><li><b>03</b><span>完成模拟微信支付</span></li><li><b>04</b><span>自动获得内容或会员</span></li></ol></section>
  </main>
}
