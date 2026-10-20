import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { signSession } from "@/lib/jwt";
import { ADMIN_COOKIE, SESSION_TTL } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "缺少用户名或密码" }, { status: 400 });
  }
  const db = getDb();
  const admin = db
    .prepare("SELECT id, password_hash FROM admins WHERE username = ?")
    .get(username) as { id: number; password_hash: string } | undefined;
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }
  const token = await signSession(String(admin.id), "admin");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}
