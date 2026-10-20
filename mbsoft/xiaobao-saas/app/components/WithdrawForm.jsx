'use client'
// 提现表单：输入提现金额（元），实时预览税费与到账金额，提交走 withdrawAction。

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import { withdrawAction } from '@/app/actions/affiliate'
import SubmitButton from '@/app/components/SubmitButton'

/**
 * @param {{ availableYuan: number, taxRate: number }} props
 */
export default function WithdrawForm({ availableYuan, taxRate }) {
  const [state, formAction] = useFormState(withdrawAction, {})
  const [amount, setAmount] = useState('')

  const yuan = Number(amount) || 0
  const tax = useMemo(() => Math.round(yuan * 100 * taxRate) / 100, [yuan, taxRate])
  const net = Math.max(0, Math.round((yuan - tax) * 100) / 100)
  const overLimit = yuan > availableYuan

  return (
    <form action={formAction} className="withdrawForm">
      {state?.error ? <p className="alert alert--error">{state.error}</p> : null}

      <div className="field">
        <label htmlFor="field-amount">提现金额（元）</label>
        <input
          id="field-amount"
          name="amount"
          type="number"
          min={0}
          step="0.01"
          max={availableYuan}
          value={amount}
          placeholder={`可提现 ${availableYuan.toFixed(2)} 元`}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <span className="fieldHint">
          税费约 {Math.round(taxRate * 1000) / 10}%，到账 = 提现金额 − 税费
        </span>
      </div>

      <div className="withdrawPreview">
        <span>税费（{Math.round(taxRate * 1000) / 10}%）</span>
        <b>¥{tax.toFixed(2)}</b>
        <span>预计到账</span>
        <b className="net">¥{net.toFixed(2)}</b>
      </div>

      <SubmitButton variant="primary" disabled={overLimit || yuan <= 0}>
        {overLimit ? '超出可提现余额' : '申请提现'}
      </SubmitButton>
    </form>
  )
}
