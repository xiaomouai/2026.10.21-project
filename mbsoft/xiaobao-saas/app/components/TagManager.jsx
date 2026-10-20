'use client'
// 标签管理入口 + 弹窗（专栏 owner 专用）：
// 侧栏渲染「标签管理 ›」触发行，点击弹出管理弹窗，支持整体重命名 / 清除标签。
// 重命名/清除走 manageTagsAction（成功后 server redirect 回专栏页）。

import { useState } from 'react'
import Modal from './Modal'
import { manageTagsAction } from '@/app/actions/creator'

/**
 * @param {{ tags: {tag: string, count: number}[] }} props
 */
export default function TagManager({ tags }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState('') // 当前处于重命名态的标签
  const [draft, setDraft] = useState('')

  const startEdit = (tag) => {
    setEditing(tag)
    setDraft(tag)
  }

  return (
    <>
      <button
        type="button"
        className="sidebarValue sidebarLink tagMgrEntry"
        onClick={() => setOpen(true)}
      >
        {tags.length ? `${tags.length} 个标签` : '暂无标签'} <span className="arrow">›</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="标签管理">
        <p className="tagMgrHint">标签来自文章，重命名或清除会影响该专栏下所有文章。</p>
        {tags.length === 0 ? (
          <p className="tagMgrEmpty">还没有任何标签，发布文章时填写标签即可创建。</p>
        ) : (
          <ul className="tagMgrList">
            {tags.map(({ tag, count }) =>
              editing === tag ? (
                <li key={tag} className="tagMgrRow editing">
                  <form action={manageTagsAction} className="tagMgrForm">
                    <input type="hidden" name="op" value="rename" />
                    <input type="hidden" name="from" value={tag} />
                    <input
                      name="to"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      required
                      maxLength={20}
                      autoFocus
                    />
                    <button type="submit" className="mini primary">
                      保存
                    </button>
                    <button
                      type="button"
                      className="mini"
                      onClick={() => setEditing('')}
                    >
                      取消
                    </button>
                  </form>
                </li>
              ) : (
                <li key={tag} className="tagMgrRow">
                  <span className="tagMgrName">
                    #{tag} <i>{count} 篇</i>
                  </span>
                  <span className="tagMgrOps">
                    <button type="button" className="mini" onClick={() => startEdit(tag)}>
                      重命名
                    </button>
                    <form action={manageTagsAction} onSubmit={(e) => {
                      if (!window.confirm(`清除标签「${tag}」？文章会保留，仅移除标签。`)) e.preventDefault()
                    }}>
                      <input type="hidden" name="op" value="delete" />
                      <input type="hidden" name="from" value={tag} />
                      <button type="submit" className="mini danger">
                        清除
                      </button>
                    </form>
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </Modal>
    </>
  )
}
