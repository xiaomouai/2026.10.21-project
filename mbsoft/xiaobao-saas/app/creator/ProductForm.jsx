'use client'
// 新建商品表单：套餐未开通或标识重复时，错误直接显示在这里（不再跳转错误页）。

import { useFormState } from 'react-dom'
import { addProductAction } from '@/app/actions/creator'
import Field from '@/app/components/Field'
import SubmitButton from '@/app/components/SubmitButton'

/** 商品发布表单：名称 / 标识 / 简介 / 适合人群 / 价格 / 模式 */
export default function ProductForm() {
  const [state, formAction] = useFormState(addProductAction, {})

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      <Field label="名称" name="name" required />
      <Field label="标识" name="slug" placeholder="product-name" required />
      <Field label="简介" name="description" type="textarea" required />
      <Field label="适合人群" name="audience" required />
      <Field label="价格" name="price" type="number" min="1" required hint="单位：元" />
      <Field
        label="模式"
        name="mode"
        type="select"
        defaultValue="lifetime"
        options={[
          { value: 'lifetime', label: '买断' },
          { value: 'subscription', label: '30天订阅' },
        ]}
      />
      <SubmitButton>发布商品</SubmitButton>
    </form>
  )
}
