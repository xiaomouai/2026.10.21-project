import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 删除充值订单，并按剩余订单重新计算用户有效期
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const orderId = Number(params.id);
  const db = getDb();

  const order = db.prepare("SELECT user_id FROM orders WHERE id = ?").get(orderId) as
    | { user_id: number }
    | undefined;
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
    const latest = db
      .prepare(
        "SELECT expires_at FROM orders WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1"
      )
      .get(order.user_id) as { expires_at: string } | undefined;
    if (latest) {
      const active = new Date(latest.expires_at).getTime() > Date.now();
      db.prepare("UPDATE users SET expires_at = ?, status = ? WHERE id = ?").run(
        latest.expires_at,
        active ? "active" : "expired",
        order.user_id
      );
    } else {
      db.prepare("UPDATE users SET status = 'expired' WHERE id = ?").run(
        order.user_id
      );
    }
  });
  tx();
  return NextResponse.json({ ok: true });
}
