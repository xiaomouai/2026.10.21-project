export const metadata = {
  title: '页面不存在｜知栈',
}

export default function NotFound() {
  return (
    <main className="auth">
      <section className="panel">
        <span className="eyebrow">404 NOT FOUND</span>
        <h1>页面不存在</h1>
        <p>你访问的店铺、商品或订单可能已下线，也可能链接输错了。</p>
        <a className="primary" href="/">
          返回首页
        </a>
      </section>
    </main>
  )
}
