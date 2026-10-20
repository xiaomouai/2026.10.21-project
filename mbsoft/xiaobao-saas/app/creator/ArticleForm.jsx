'use client'
// 文章表单：新建走 addArticleAction，传入 articleId 时复用为编辑表单走 editArticleAction。
// 正文使用 Markdown 编辑器组件，编辑模式下商品只读展示。

import { useFormState } from 'react-dom'
import { addArticleAction, editArticleAction } from '@/app/actions/creator'
import Editor from '@/app/components/Editor'
import EmptyState from '@/app/components/EmptyState'
import Field from '@/app/components/Field'
import SubmitButton from '@/app/components/SubmitButton'

/**
 * 文章发布 / 编辑表单。
 * 双提交按钮：点「发布文章」提交 status=published，点「存为草稿」提交 status=draft。
 * @param {{products?: {value: number|string, label: string}[], articleId?: number, initial?: {title?: string, summary?: string, body?: string, tag?: string}, productName?: string}} props
 */
export default function ArticleForm({ products, articleId, initial, productName }) {
  const editing = Boolean(articleId)
  const [state, formAction] = useFormState(editing ? editArticleAction : addArticleAction, {})

  if (!editing && (!products || products.length === 0)) {
    return <EmptyState title="还没有商品" description="先在「商品」页发布一个商品，才能往里写文章。" />
  }

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      {editing ? <input type="hidden" name="articleId" value={articleId} /> : null}
      {editing ? (
        <Field label="所属商品" name="productName" defaultValue={productName} disabled />
      ) : (
        <Field label="所属商品" name="productId" type="select" options={products} required />
      )}
      <Field label="标题" name="title" defaultValue={initial?.title} required />
      <Field
        label="摘要"
        name="summary"
        type="textarea"
        rows={2}
        defaultValue={initial?.summary}
        required
        hint="公开可见，付费正文前的介绍"
      />
      <Editor name="body" defaultValue={initial?.body || ''} hint="仅已购读者可见" />
      <Field label="标签" name="tag" defaultValue={initial?.tag} required />
      <div className="formActions">
        <SubmitButton name="status" value="published" variant="secondary">
          {editing ? '保存并发布' : '发布文章'}
        </SubmitButton>
        <SubmitButton name="status" value="draft" variant="primary">
          存为草稿
        </SubmitButton>
      </div>
    </form>
  )
}
