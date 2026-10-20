import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getOrder, getUserBySession, StoreError } from '../../../../store/store-db'

export async function GET(_request, { params }) {
  try {
    const user = getUserBySession(cookies().get('store_session')?.value)
    if (!user) throw new StoreError('请先登录', 401)
    return NextResponse.json({ order: getOrder(user.id, params.orderNo) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof StoreError ? error.message : '订单读取失败，请稍后再试' }, { status: error.status || 500 })
  }
}
