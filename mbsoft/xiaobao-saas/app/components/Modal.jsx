'use client'
// 通用弹窗外壳：遮罩 + 居中卡片 + 关闭按钮 + Esc/点遮罩关闭。
// 移动端宽度自适应：min(92vw, 420px)。

import { useEffect } from 'react'

/**
 * @param {{ open: boolean, title: string, onClose: () => void, children: import('react').ReactNode }} props
 */
export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modalBackdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHead">
          <b>{title}</b>
          <button type="button" className="modalClose" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  )
}
