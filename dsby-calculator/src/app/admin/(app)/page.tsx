import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function fmtDate(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminDashboard() {
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
    .prepare("SELECT expires_at FROM users")
    .all() as { expires_at: string }[];
  const usersActive = activeRows.filter(
    (u) => new Date(u.expires_at).getTime() > now
  ).length;

  const recentOrders = db
    .prepare(
      `SELECT o.id, u.username, o.amount, o.duration_days, o.expires_at, o.created_at, o.created_by
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC LIMIT 10`
    )
    .all();
  const recentUsers = db
    .prepare(
      "SELECT id, username, expires_at, status, created_at FROM users ORDER BY id DESC LIMIT 10"
    )
    .all();

  const cards = [
    { label: "总充值金额", value: `¥${totalRecharge.toFixed(2)}` },
    { label: "订单总数", value: String(ordersCount) },
    { label: "用户总数", value: String(usersTotal) },
    { label: "有效用户", value: String(usersActive) },
  ];

  return (
    <div>
      <h2 className="admin-page-title">统计仪表盘</h2>
      <div className="admin-stat-grid">
        {cards.map((c) => (
          <div className="admin-stat-card" key={c.label}>
            <div className="admin-stat-value">{c.value}</div>
            <div className="admin-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <h3 className="admin-section-title">最近充值订单</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户</th>
              <th>金额</th>
              <th>时长(天)</th>
              <th>到期</th>
              <th>操作人</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">
                  暂无订单
                </td>
              </tr>
            )}
            {recentOrders.map((o: any) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.username || "(已删)"}</td>
                <td>¥{Number(o.amount).toFixed(2)}</td>
                <td>{o.duration_days}</td>
                <td>{fmtDate(o.expires_at)}</td>
                <td>{o.created_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="admin-section-title">最近用户</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>状态</th>
              <th>到期</th>
              <th>创建</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((u: any) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>
                  <span
                    className={
                      new Date(u.expires_at).getTime() > now
                        ? "badge badge-ok"
                        : "badge badge-bad"
                    }
                  >
                    {new Date(u.expires_at).getTime() > now ? "有效" : "过期"}
                  </span>
                </td>
                <td>{fmtDate(u.expires_at)}</td>
                <td>{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
