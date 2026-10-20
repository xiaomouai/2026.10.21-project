'use client'
// 复制到剪贴板按钮：点击复制 text，短暂显示「已复制」反馈。
// 用于分享卡片链接、分销推广链接等场景。

import { useState } from 'react'

/**
 * @param {{ text: string, label?: string, className?: string }} props
 */
export default function CopyLink({ text, label = '复制链接', className = 'secondary' }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // 剪贴板不可用（如非安全上下文）时静默失败，用户可手动复制
    }
  }

  return (
    <button type="button" className={className} onClick={onCopy}>
      {copied ? '已复制' : label}
    </button>
  )
}
