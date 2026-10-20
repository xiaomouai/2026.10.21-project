'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchaseButton({ productSlug }) {
  const router = useRouter(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  async function buy() {
    setError(''); setLoading(true)
    try {
      const response = await fetch('/api/store/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productSlug }) })
      if (response.status === 401) return router.push(`/store/login?returnTo=${encodeURIComponent(`/store/product/${productSlug}`)}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '创建订单失败')
      router.push(`/store/checkout/${result.order.order_no}`)
    } catch (reason) { setError(reason.message); setLoading(false) }
  }
  return <div><button className="store-primary full" onClick={buy} disabled={loading}>{loading ? '正在创建订单…' : '立即购买'}</button>{error && <p className="form-error">{error}</p>}</div>
}
