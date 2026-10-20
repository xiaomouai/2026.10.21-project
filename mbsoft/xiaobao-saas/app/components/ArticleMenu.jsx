'use client'
// 文章 ⋮ 操作菜单（仅专栏 owner 可见）：编辑 / 分享 / 删除。
// 删除走 deleteArticleAction（成功后 server redirect 回专栏页）。

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ShareModal from './ShareModal'
import { deleteArticleAction } from '@/app/actions/creator'

/**
 * @param {{ articleId: number, articleTitle: string, editHref: string, sharePath: string }} props
 */
export default function ArticleMenu({ articleId, articleTitle, editHref, sharePath }) {
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="articleMenu" ref={ref}>
      <button
        type="button"
        className="menuBtn"
        aria-label="文章操作"
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open ? (
        <div className="menuPop">
          <Link href={editHref} className="menuItem" onClick={() => setOpen(false)}>
            编辑
          </Link>
          <button
            type="button"
            className="menuItem"
            onClick={() => {
              setOpen(false)
              setSharing(true)
            }}
          >
            分享
          </button>
          <form action={deleteArticleAction} onSubmit={(e) => {
            if (!window.confirm(`确定删除「${articleTitle}」？此操作不可恢复。`)) e.preventDefault()
          }}>
            <input type="hidden" name="articleId" value={articleId} />
            <button type="submit" className="menuItem danger">
              删除
            </button>
          </form>
        </div>
      ) : null}
      <ShareModal
        open={sharing}
        onClose={() => setSharing(false)}
        title={articleTitle}
        path={sharePath}
      />
    </div>
  )
}
