'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MockPayButton({ orderNo }) {
  const router = useRouter(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function pay() {
    setError(''); setLoading(true)
    try {
      const response = await fetch('/api/store/payments/wechat/mock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderNo }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '支付失败')
      router.push(`/store/payment/success/${orderNo}`); router.refresh()
    } catch (reason) { setError(reason.message); setLoading(false) }
  }
  return <div><button className="wechat-pay" onClick={pay} disabled={loading}>{loading ? '正在处理…' : '模拟微信支付成功'}</button>{error && <p className="form-error">{error}</p>}</div>
}
