import { getDb } from "@/lib/db";
import AdminForm from "@/components/admin/AdminForm";

export const dynamic = "force-dynamic";

function fmtDate(s?: string) {
  if (!s) return "-";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export default function AdminsPage() {
  const db = getDb();
  const list = db
    .prepare("SELECT id, username, created_at FROM admins ORDER BY id")
    .all();

  return (
    <div>
      <h2 className="admin-page-title">管理员账号</h2>
      <AdminForm />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a: any) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.username}</td>
                <td>{fmtDate(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
