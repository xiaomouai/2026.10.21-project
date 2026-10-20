import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/server-auth";
import LogoutButton from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">💧 管理后台</div>
        <nav className="admin-nav">
          <a className="admin-nav-item" href="/admin">
            仪表盘
          </a>
          <a className="admin-nav-item" href="/admin/admins">
            管理员
          </a>
          <a className="admin-nav-item" href="/admin/users">
            用户
          </a>
          <a className="admin-nav-item" href="/admin/orders">
            充值订单
          </a>
        </nav>
        <div className="admin-sidebar-foot">
          <div className="admin-user">👤 {admin.username}</div>
          <LogoutButton />
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
