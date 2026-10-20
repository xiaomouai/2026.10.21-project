'use client'
// 商品购买表单：客户端组件，用 useFormState 内联展示下单失败原因。

import { useFormState } from 'react-dom'
import { buyAction } from '@/app/actions/shop'
import SubmitButton from '@/app/components/SubmitButton'

/** 购买表单：提交隐藏的 productId 与推广码 refCode，错误以 alert 形式展示在按钮上方 */
export default function BuyForm({ productId, refCode }) {
  const [state, formAction] = useFormState(buyAction, null)

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      <input type="hidden" name="productId" value={productId} />
      {refCode ? <input type="hidden" name="ref" value={refCode} /> : null}
      <SubmitButton>立即购买</SubmitButton>
    </form>
  )
}
