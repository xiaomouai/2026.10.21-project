import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getUserBySession, payMock, StoreError } from '../../../../../store/store-db'

export async function POST(request) {
  try {
    const user = getUserBySession(cookies().get('store_session')?.value)
    if (!user) throw new StoreError('请先登录', 401)
    const { orderNo = '' } = await request.json()
    return NextResponse.json({ order: payMock(user.id, orderNo) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof StoreError ? error.message : '支付处理失败，请稍后再试' }, { status: error.status || 500 })
  }
}
