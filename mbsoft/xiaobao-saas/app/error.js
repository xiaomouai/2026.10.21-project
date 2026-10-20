'use client'

export default function Error({ error, reset }) {
  return (
    <main className="auth">
      <section className="panel">
        <span className="eyebrow">SOMETHING WENT WRONG</span>
        <h1>页面出错了</h1>
        <div className="alert alert--error">
          {error?.message || '发生未知错误，请稍后重试。'}
        </div>
        <button type="button" className="primary" onClick={() => reset()}>
          重试
        </button>
      </section>
    </main>
  )
}
