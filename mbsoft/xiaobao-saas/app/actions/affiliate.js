'use server'
// 合伙人钱包的 Server Action：申请提现（金额以元为单位提交，服务端转分）。
// 校验不通过时内联返回错误，成功则跳回分销中心。

import { redirect } from 'next/navigation'
import { AppError, requestWithdraw } from '@/lib'
import { requireUser } from '@/lib/auth/session'

/**
 * 提现：校验余额后于事务内扣减并写入提现记录，按 6.1% 计提税费。
 * @param {object} prevState 上一次的表单状态
 * @param {FormData} formData 含 amount（元）
 */
export async function withdrawAction(prevState, formData) {
  const user = requireUser()
  try {
    const amountYuan = Number(formData.get('amount'))
    requestWithdraw(user.id, Math.round(amountYuan * 100))
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
  redirect('/affiliate')
}
