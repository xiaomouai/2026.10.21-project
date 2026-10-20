import { NextRequest, NextResponse } from "next/server";
import { getDb, addDays } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const list = db
    .prepare(
      `SELECT o.id, o.user_id, u.username, o.amount, o.duration_days,
              o.starts_at, o.expires_at, o.status, o.note, o.created_by, o.created_at
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC`
    )
    .all();
  return NextResponse.json(list);
}

// 为指定用户创建充值订单并顺延有效期
export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { user_id, amount, duration_days, note } = await req.json();
  const userId = Number(user_id);
  const days = Number(duration_days) || 0;
  const money = Number(amount) || 0;
  if (!userId || days <= 0) {
    return NextResponse.json(
      { error: "请选择用户并填写有效时长（天）" },
      { status: 400 }
    );
  }
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
    | { id: number; expires_at: string }
    | undefined;
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const now = new Date().toISOString();
  const startsAt =
    new Date(user.expires_at).getTime() > Date.now() ? user.expires_at : now;
  const expiresAt = addDays(startsAt, days);

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (user_id, amount, duration_days, starts_at, expires_at, status, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      money,
      days,
      startsAt,
      expiresAt,
      "active",
      note || null,
      admin.username,
      now
    );
    db.prepare("UPDATE users SET expires_at = ?, status = 'active' WHERE id = ?").run(
      expiresAt,
      userId
    );
  });
  tx();
  return NextResponse.json({ ok: true });
}
