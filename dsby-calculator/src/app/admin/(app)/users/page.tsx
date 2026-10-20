import { getDb } from "@/lib/db";
import UserForm from "@/components/admin/UserForm";
import DeleteButton from "@/components/admin/DeleteButton";

export const dynamic = "force-dynamic";

function fmtDate(s?: string) {
  if (!s) return "-";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export default function UsersPage() {
  const db = getDb();
  const now = Date.now();
  const list = db
    .prepare(
      "SELECT id, username, email, expires_at, status, note, created_at FROM users ORDER BY id DESC"
    )
    .all();

  return (
    <div>
      <h2 className="admin-page-title">用户账号</h2>
      <p className="admin-hint">
        创建用户时填写「充值金额 + 使用时长(天)」，系统自动开通并生成首笔订单。
      </p>
      <UserForm />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>到期</th>
              <th>状态</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u: any) => {
              const active = new Date(u.expires_at).getTime() > now;
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email || "-"}</td>
                  <td>{fmtDate(u.expires_at)}</td>
                  <td>
                    <span className={active ? "badge badge-ok" : "badge badge-bad"}>
                      {active ? "有效" : "过期"}
                    </span>
                  </td>
                  <td>{u.note || "-"}</td>
                  <td>
                    <DeleteButton url={`/api/admin/users/${u.id}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
