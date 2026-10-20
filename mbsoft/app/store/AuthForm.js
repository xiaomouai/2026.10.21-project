'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthForm({ mode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true)
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch(`/api/store/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '操作失败')
      const requested = searchParams.get('returnTo') || ''
      router.push(requested.startsWith('/store/') ? requested : '/store/account'); router.refresh()
    } catch (reason) { setError(reason.message) } finally { setLoading(false) }
  }
  const register = mode === 'register'
  const suffix = searchParams.get('returnTo') ? `?returnTo=${encodeURIComponent(searchParams.get('returnTo'))}` : ''
  return <form className="auth-card" onSubmit={submit}><span className="store-kicker">MEMBER ACCESS</span><h1>{register ? '创建账户' : '欢迎回来'}</h1><p>{register ? '注册后即可继续购买并查看订单。' : '登录后继续购买或查看已购内容。'}</p>{error && <div className="form-error">{error}</div>}<label>邮箱<input name="email" type="email" autoComplete="email" required maxLength="254" placeholder="you@example.com"/></label><label>密码<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength="8" maxLength="128" placeholder="至少8位"/></label><button className="store-primary full" disabled={loading}>{loading ? '处理中…' : register ? '注册并登录' : '登录'}</button><small>{register ? <>已有账户？<Link href={`/store/login${suffix}`}>直接登录</Link></> : <>还没有账户？<Link href={`/store/register${suffix}`}>立即注册</Link></>}</small></form>
}
