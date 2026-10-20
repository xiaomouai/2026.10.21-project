'use client'
// 店铺设置表单：名称 / 地址标识 / 简介，错误信息内联展示。

import { useFormState } from 'react-dom'
import { saveStoreAction } from '@/app/actions/creator'
import Field from '@/app/components/Field'
import SubmitButton from '@/app/components/SubmitButton'

/** 店铺资料表单，tenant 为空对象时按新建处理 */
export default function StoreForm({ tenant }) {
  const [state, formAction] = useFormState(saveStoreAction, {})

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      <Field label="名称" name="name" defaultValue={tenant.name} required />
      <Field label="地址标识" name="slug" defaultValue={tenant.slug} required hint="只能用小写字母、数字和连字符" />
      <Field
        label="简介"
        name="description"
        type="textarea"
        defaultValue={tenant.description || '分享可执行、可验证的知识产品。'}
        required
      />
      <Field
        label="介绍页"
        name="intro"
        type="textarea"
        rows={8}
        defaultValue={tenant.intro || ''}
        hint="支持 Markdown，展示在专栏的「关于我」介绍页"
      />
      <SubmitButton variant="secondary">保存店铺</SubmitButton>
    </form>
  )
}
