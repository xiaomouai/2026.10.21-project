import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const now = Date.now();

  const totalRecharge = (
    db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM orders").get() as {
      s: number;
    }
  ).s;
  const ordersCount = (
    db.prepare("SELECT COUNT(*) AS c FROM orders").get() as { c: number }
  ).c;
  const usersTotal = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  const activeRows = db
    .prepare("SELECT id, expires_at FROM users")
    .all() as { id: number; expires_at: string }[];
  const usersActive = activeRows.filter(
    (u) => new Date(u.expires_at).getTime() > now
  ).length;
  const usersExpired = usersTotal - usersActive;

  const recentOrders = db
    .prepare(
      `SELECT o.id, o.user_id, u.username, o.amount, o.duration_days, o.expires_at, o.created_at, o.created_by
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC LIMIT 10`
    )
    .all();
  const recentUsers = db
    .prepare(
      "SELECT id, username, email, expires_at, status, created_at FROM users ORDER BY id DESC LIMIT 10"
    )
    .all();

  return NextResponse.json({
    totalRecharge,
    ordersCount,
    usersTotal,
    usersActive,
    usersExpired,
    recentOrders,
    recentUsers,
  });
}
