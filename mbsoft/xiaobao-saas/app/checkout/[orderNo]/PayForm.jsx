'use client'
// 支付表单：客户端组件，用 useFormState 内联展示模拟支付失败原因。

import { useFormState } from 'react-dom'
import { payAction } from '@/app/actions/shop'
import SubmitButton from '@/app/components/SubmitButton'

/** 支付表单：提交隐藏的订单号，模拟支付未开启时按钮置灰 */
export default function PayForm({ orderNo, disabled }) {
  const [state, formAction] = useFormState(payAction, null)

  return (
    <form action={formAction}>
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}
      <input type="hidden" name="orderNo" value={orderNo} />
      {disabled ? (
        <button className="wechat" disabled>
          模拟微信支付成功
        </button>
      ) : (
        <SubmitButton variant="wechat">模拟微信支付成功</SubmitButton>
      )}
    </form>
  )
}
