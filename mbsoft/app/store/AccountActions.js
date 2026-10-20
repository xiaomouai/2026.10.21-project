'use client'

import { useRouter } from 'next/navigation'

export default function AccountActions() {
  const router = useRouter()
  async function logout() { await fetch('/api/store/logout', { method: 'POST' }); router.push('/store/login'); router.refresh() }
  return <button className="text-button" onClick={logout}>退出登录</button>
}
