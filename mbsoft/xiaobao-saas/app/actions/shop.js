'use server'
// 交易链路的 Server Action：商品下单与模拟微信支付。
// 两个 action 都配合 useFormState 使用，业务错误内联返回，redirect 抛出的 NEXT_REDIRECT 必须原样透传。

import { redirect } from 'next/navigation'
import { AppError, LOGIN_PATH, createOrder, pay, requestConfirm } from '@/lib'
import { currentUser, requireUser } from '@/lib/auth/session'

/** 下单：未登录跳登录页，非读者账号内联报错，成功后跳到收银台 */
export async function buyAction(prevState, formData) {
  const user = currentUser()
  if (!user) redirect(LOGIN_PATH)
  if (user.role !== 'reader') return { error: '请使用读者账号购买' }
  try {
    const orderNo = createOrder(user.id, 'product', formData.get('productId'), formData.get('ref'))
    redirect('/checkout/' + orderNo)
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
}

/** 模拟支付：支付成功后按角色跳回创作者后台或我的内容 */
export async function payAction(prevState, formData) {
  const user = requireUser()
  try {
    pay(user.id, formData.get('orderNo'))
    redirect(user.role === 'creator' ? '/creator' : '/library')
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
}

/**
 * 申报已付款（店铺自收款流程）：读者扫码付给店主后点击确认，
 * 订单进入「待确认」，跳回我的内容等待店主确认收款。
 */
export async function requestConfirmAction(prevState, formData) {
  const user = requireUser()
  try {
    requestConfirm(user.id, formData.get('orderNo'))
    redirect('/library')
  } catch (e) {
    if (e instanceof AppError) return { error: e.message }
    throw e
  }
}
