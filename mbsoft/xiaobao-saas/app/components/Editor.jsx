'use client'
// Markdown 编辑器：工具栏（标题/粗体/斜体/引用/列表/代码/链接）+ 写作/预览双模式。
// 预览用 lib/markdown 的 renderMarkdown 实时渲染（输出已做 HTML 转义，可安全注入）。

import { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '@/lib/markdown'

/** 行内工具：在选区两侧包裹语法；无选区时插入占位文字并选中它 */
const INLINE_TOOLS = [
  { label: 'B', title: '粗体', before: '**', after: '**', placeholder: '粗体文字' },
  { label: 'I', title: '斜体', before: '*', after: '*', placeholder: '斜体文字' },
  { label: '</>', title: '行内代码', before: '`', after: '`', placeholder: 'code' },
  { label: '链接', title: '链接', before: '[', after: '](https://)', placeholder: '文字' },
  { label: '代码块', title: '代码块', before: '```\n', after: '\n```', placeholder: 'code' },
]

/** 行级工具：对选区覆盖的每一行加/去前缀（再点一次可撤销） */
const LINE_TOOLS = [
  { label: 'H2', title: '标题', prefix: '## ' },
  { label: '引用', title: '引用', prefix: '> ' },
  { label: '• 列表', title: '无序列表', prefix: '- ' },
  { label: '1. 列表', title: '有序列表', prefix: '1. ' },
]

/**
 * Markdown 编辑器，表单提交时字段名为 body。
 * @param {{name?: string, defaultValue?: string, rows?: number, placeholder?: string, label?: string}} props
 */
export default function Editor({
  name = 'body',
  defaultValue = '',
  rows = 16,
  placeholder = '用 Markdown 写作…',
  label = '正文',
  hint,
}) {
  const [value, setValue] = useState(defaultValue)
  const [mode, setMode] = useState('write')
  const ta = useRef(null)
  const pendingSel = useRef(null)

  // 受控回写后恢复光标选区
  useEffect(() => {
    if (pendingSel.current && ta.current) {
      const { start, end } = pendingSel.current
      ta.current.focus()
      ta.current.setSelectionRange(start, end)
      pendingSel.current = null
    }
  }, [value])

  /** 应用文本替换并记录期望的选区位置 */
  const apply = (next, start, end) => {
    pendingSel.current = { start, end }
    setValue(next)
  }

  /** 行内包裹：选区外套语法，无选区时插入占位文字并选中 */
  const wrap = ({ before, after, placeholder: ph }) => {
    const el = ta.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const inner = value.slice(s, e) || ph
    const next = value.slice(0, s) + before + inner + after + value.slice(e)
    const innerStart = s + before.length
    apply(next, innerStart, innerStart + inner.length)
  }

  /** 行级前缀：选区覆盖的每一行统一加前缀；已全部带前缀则移除 */
  const prefixLines = ({ prefix }) => {
    const el = ta.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    let lineEnd = value.indexOf('\n', e)
    if (lineEnd === -1) lineEnd = value.length
    const block = value.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    const allPrefixed = lines.every((l) => l.startsWith(prefix))
    const nextBlock = lines
      .map((l) => (allPrefixed ? l.slice(prefix.length) : prefix + l))
      .join('\n')
    const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd)
    apply(next, lineStart, lineStart + nextBlock.length)
  }

  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      <div className="editor">
        <div className="editorBar">
          <div className="editorTools">
            {LINE_TOOLS.map((t) => (
              <button key={t.title} type="button" title={t.title} disabled={mode === 'preview'} onClick={() => prefixLines(t)}>
                {t.label}
              </button>
            ))}
            {INLINE_TOOLS.map((t) => (
              <button key={t.title} type="button" title={t.title} disabled={mode === 'preview'} onClick={() => wrap(t)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="editorTabs">
            <button type="button" className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>
              写作
            </button>
            <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>
              预览
            </button>
          </div>
        </div>
        <textarea
          ref={ta}
          name={name}
          rows={rows}
          value={value}
          placeholder={placeholder}
          hidden={mode === 'preview'}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
        />
        {mode === 'preview' ? (
          <div className="editorPreview md">
            {value.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
            ) : (
              <p className="meta">暂无内容，切回「写作」开始 Markdown 创作。</p>
            )}
          </div>
        ) : null}
      </div>
      {hint ? <span className="fieldHint">{hint}</span> : null}
    </div>
  )
}
