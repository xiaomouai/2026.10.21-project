import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const list = db
    .prepare("SELECT id, username, created_at FROM admins ORDER BY id")
    .all();
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { username, password } = await req.json();
  if (!username || !password || password.length < 6) {
    return NextResponse.json(
      { error: "用户名必填，密码至少 6 位" },
      { status: 400 }
    );
  }
  const db = getDb();
  const exists = db
    .prepare("SELECT id FROM admins WHERE username = ?")
    .get(username);
  if (exists) {
    return NextResponse.json({ error: "管理员用户名已存在" }, { status: 409 });
  }
  db.prepare(
    "INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)"
  ).run(username, hashPassword(password), new Date().toISOString());
  return NextResponse.json({ ok: true });
}
