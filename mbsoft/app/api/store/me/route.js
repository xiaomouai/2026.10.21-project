import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySession } from '../../../store/store-db'

export async function GET() {
  const token = cookies().get('store_session')?.value
  const user = getUserBySession(token)
  return NextResponse.json({ user }, { status: user ? 200 : 401 })
}
