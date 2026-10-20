import { NextRequest, NextResponse } from "next/server";
import { getDb, addDays } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const list = db
    .prepare(
      "SELECT id, username, email, expires_at, status, note, created_at FROM users ORDER BY id DESC"
    )
    .all();
  return NextResponse.json(list);
}

// 创建用户时一并生成首笔充值订单（金额 + 使用时长）
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const { username, password, email, amount, duration_days, note } = body;
  if (!username || !password || password.length < 6) {
    return NextResponse.json(
      { error: "用户名必填，密码至少 6 位" },
      { status: 400 }
    );
  }
  const days = Number(duration_days) || 0;
  const money = Number(amount) || 0;
  const db = getDb();

  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) {
    return NextResponse.json({ error: "用户已存在" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const expiresAt = addDays(null, days);

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO users (username, password_hash, email, created_at, expires_at, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        username,
        hashPassword(password),
        email || null,
        now,
        expiresAt,
        days > 0 ? "active" : "expired",
        note || null
      );
    const userId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO orders (user_id, amount, duration_days, starts_at, expires_at, status, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      money,
      days,
      now,
      expiresAt,
      days > 0 ? "active" : "expired",
      note || null,
      admin.username,
      now
    );
    return userId;
  });
  tx();
  return NextResponse.json({ ok: true });
}
