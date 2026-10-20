'use client'
// 合伙人计划设置表单：开启开关 + 佣金比例（百分比，0~40）。

import { useFormState } from 'react-dom'
import { updatePartnerAction } from '@/app/actions/creator'
import Field from '@/app/components/Field'
import SubmitButton from '@/app/components/SubmitButton'

/**
 * @param {{ enabled: boolean, ratePercent: number, maxPercent: number }} props
 */
export default function PartnerForm({ enabled, ratePercent, maxPercent }) {
  const [state, formAction] = useFormState(updatePartnerAction, {})

  return (
    <form action={formAction} className="partnerForm">
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}

      <label className="switch">
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        <span>开启合伙人计划</span>
      </label>

      <p className="meta">
        开启后，读者可生成你的专栏专属推广链接与二维码；他人经链接付费时，推广者将获得你设置的报酬。
      </p>

      <Field
        label="佣金比例（%）"
        name="ratePercent"
        type="number"
        defaultValue={ratePercent}
        min={0}
        max={maxPercent}
        step={1}
        required
        hint={`最高可设置 ${maxPercent}%，即订单实付金额的对应比例作为合伙人报酬`}
      />

      <SubmitButton variant="secondary">保存合伙人设置</SubmitButton>
    </form>
  )
}
