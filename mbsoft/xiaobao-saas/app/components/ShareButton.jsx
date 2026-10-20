'use client'
// 独立分享按钮：渲染按钮 + 分享弹窗（用于文章阅读页）。

import { useState } from 'react'
import ShareModal from './ShareModal'

/**
 * @param {{ title: string, path: string, label?: string }} props
 */
export default function ShareButton({ title, path, label = '分享' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="mini shareBtn" onClick={() => setOpen(true)}>
        ↗ {label}
      </button>
      <ShareModal open={open} onClose={() => setOpen(false)} title={title} path={path} />
    </>
  )
}
