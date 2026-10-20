'use client'
// 申报付款表单：读者扫码向店主付款后点击确认，订单进入「待店主确认」。

import { useFormState } from 'react-dom'
import { requestConfirmAction } from '@/app/actions/shop'
import SubmitButton from '@/app/components/SubmitButton'

/** 申报付款表单：提交隐藏的订单号 */
export default function ConfirmPayForm({ orderNo }) {
  const [state, formAction] = useFormState(requestConfirmAction, null)

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      <input type="hidden" name="orderNo" value={orderNo} />
      <SubmitButton variant="wechat">我已完成付款</SubmitButton>
    </form>
  )
}
