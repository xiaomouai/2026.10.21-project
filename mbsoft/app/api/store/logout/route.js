import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logout } from '../../../store/store-db'

export async function POST() {
  const token = cookies().get('store_session')?.value
  logout(token)
  const response = NextResponse.json({ loggedOut: true })
  response.cookies.set('store_session', '', { httpOnly: true, sameSite: 'lax', path: '/', expires: new Date(0) })
  return response
}
