import { NextRequest, NextResponse } from "next/server";
import { getDb, addDays } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(params.id);
  const body = await req.json();
  const db = getDb();

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | { id: number; expires_at: string; status: string }
    | undefined;
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const tx = db.transaction(() => {
    if (body.password && String(body.password).length >= 6) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        hashPassword(String(body.password)),
        id
      );
    }
    if (typeof body.note === "string") {
      db.prepare("UPDATE users SET note = ? WHERE id = ?").run(body.note, id);
    }
    const days = Number(body.duration_days) || 0;
    const amount = Number(body.amount) || 0;
    if (days > 0) {
      const startsAt =
        new Date(user.expires_at).getTime() > Date.now()
          ? user.expires_at
          : new Date().toISOString();
      const expiresAt = addDays(startsAt, days);
      db.prepare(
        `INSERT INTO orders (user_id, amount, duration_days, starts_at, expires_at, status, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        amount,
        days,
        startsAt,
        expiresAt,
        "active",
        body.note || "续费",
        admin.username,
        new Date().toISOString()
      );
      db.prepare("UPDATE users SET expires_at = ?, status = 'active' WHERE id = ?").run(
        expiresAt,
        id
      );
    }
  });
  tx();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(params.id);
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM orders WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
