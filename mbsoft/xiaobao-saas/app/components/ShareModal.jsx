'use client'
// 分享卡片弹窗：标题 + 二维码（/api/qr 服务端 SVG）+ 链接 + 复制按钮。

import { useMemo, useState } from 'react'
import Modal from './Modal'

/**
 * @param {{ open: boolean, onClose: () => void, title: string, path: string }} props
 *   path 为站内路径（如 /read/8），完整链接取当前页面的 origin 拼接。
 */
export default function ShareModal({ open, onClose, title, path }) {
  const [copied, setCopied] = useState(false)
  const fullUrl = useMemo(() => {
    if (typeof window === 'undefined') return path
    return new URL(path, window.location.origin).toString()
  }, [path])

  if (!open) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
    } catch {
      // http 非安全环境降级：选中兜底由用户手动复制
      const el = document.querySelector('.shareUrlBox')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Modal open={open} onClose={onClose} title="分享">
      <div className="shareCard">
        <h3 className="shareTitle">{title}</h3>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="shareQr"
          src={`/api/qr?text=${encodeURIComponent(fullUrl)}`}
          alt="分享二维码"
          width={200}
          height={200}
        />
        <p className="shareHint">扫码或复制链接分享</p>
        <div className="shareUrlBox">{fullUrl}</div>
        <button type="button" className="primary shareCopy" onClick={copy}>
          {copied ? '已复制 ✓' : '复制链接'}
        </button>
      </div>
    </Modal>
  )
}
