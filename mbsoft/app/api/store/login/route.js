import { NextResponse } from 'next/server'
import { login, StoreError } from '../../../store/store-db'

export async function POST(request) {
  try {
    const { email = '', password = '' } = await request.json()
    const result = login(email, password)
    const response = NextResponse.json({ user: result.user })
    response.cookies.set('store_session', result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: new Date(result.expiresAt * 1000) })
    return response
  } catch (error) { return NextResponse.json({ error: error instanceof StoreError ? error.message : '登录失败，请稍后再试' }, { status: error.status || 401 }) }
}
