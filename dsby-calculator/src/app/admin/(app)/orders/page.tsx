import { getDb } from "@/lib/db";
import OrderForm from "@/components/admin/OrderForm";
import DeleteButton from "@/components/admin/DeleteButton";

export const dynamic = "force-dynamic";

function fmtDate(s?: string) {
  if (!s) return "-";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export default function OrdersPage() {
  const db = getDb();
  const list = db
    .prepare(
      `SELECT o.id, u.username, o.amount, o.duration_days, o.starts_at, o.expires_at,
              o.status, o.note, o.created_by, o.created_at
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC`
    )
    .all();
  const users = db
    .prepare("SELECT id, username FROM users ORDER BY id")
    .all() as { id: number; username: string }[];

  return (
    <div>
      <h2 className="admin-page-title">充值订单</h2>
      <p className="admin-hint">
        为指定用户创建充值订单，有效期将在原到期时间上顺延（未到期则累加）。
      </p>
      <OrderForm users={users} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户</th>
              <th>金额</th>
              <th>时长(天)</th>
              <th>开始</th>
              <th>到期</th>
              <th>操作人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="admin-empty">
                  暂无订单
                </td>
              </tr>
            )}
            {list.map((o: any) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.username || "(已删)"}</td>
                <td>¥{Number(o.amount).toFixed(2)}</td>
                <td>{o.duration_days}</td>
                <td>{fmtDate(o.starts_at)}</td>
                <td>{fmtDate(o.expires_at)}</td>
                <td>{o.created_by}</td>
                <td>
                  <DeleteButton url={`/api/admin/orders/${o.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
