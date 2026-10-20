import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import "../admin.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "后台登录 · 好宝宝育儿知识库",
};

export default function AdminLoginPage() {
  if (getAdminUser()) redirect("/admin");

  return (
    <div className="admin-login-root">
      <div className="admin-login-card">
        <div className="admin-login-badge" aria-hidden>🌙</div>
        <h1>后台管理系统</h1>
        <p className="a-sub">好宝宝育儿知识库 · 管理员登录</p>

        <AdminLoginForm />

        <div className="admin-login-hint">
          管理员邮箱：<code>admin@test.com</code>；首次创建前需设置 <code>ADMIN_PASSWORD</code>
          <br />
          仅 <code>role = admin</code> 的账号可进入后台，普通会员登录会被拒绝。
        </div>

        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link href="/">← 返回前台站点</Link>
        </p>
      </div>
    </div>
  );
}
