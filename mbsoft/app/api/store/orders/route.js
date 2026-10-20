import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createOrder, getUserBySession, listOrders, StoreError } from '../../../store/store-db'

function user() { return getUserBySession(cookies().get('store_session')?.value) }
function failure(error) { return NextResponse.json({ error: error instanceof StoreError ? error.message : '订单操作失败，请稍后再试' }, { status: error.status || 500 }) }

export async function POST(request) {
  try {
    const current = user()
    if (!current) throw new StoreError('请先登录', 401)
    const { productSlug = '' } = await request.json()
    return NextResponse.json({ order: createOrder(current.id, productSlug) }, { status: 201 })
  } catch (error) { return failure(error) }
}

export async function GET() {
  try {
    const current = user()
    if (!current) throw new StoreError('请先登录', 401)
    return NextResponse.json({ orders: listOrders(current.id) })
  } catch (error) { return failure(error) }
}
