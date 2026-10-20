"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "数据概览", icon: "📊", exact: true },
  { href: "/admin/members", label: "会员管理", icon: "👥" },
  { href: "/admin/cards", label: "授权卡", icon: "🎫" },
  { href: "/admin/topics", label: "知识库管理", icon: "📚" },
  { href: "/admin/settings", label: "大模型配置", icon: "🤖" },
];

export default function AdminShell({
  user,
  children,
}: {
  user: { nickname: string; email: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const current = NAV.find(isActive) ?? NAV[0];

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-root">
      {/* 桌面侧边栏 */}
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="admin-brand-badge">🌙</span>
          <span>
            育儿知识库
            <small>ADMIN CONSOLE</small>
          </span>
        </div>
        <nav className="admin-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={isActive(n) ? "active" : ""}>
              <span className="admin-nav-ico" aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link href="/" target="_blank" rel="noreferrer">
            <span aria-hidden>↗</span> 查看前台站点
          </Link>
          <button onClick={logout}>
            <span aria-hidden>⎋</span> 退出登录
          </button>
        </div>
      </aside>

      <div className="admin-main">
        {/* 移动端横向导航 */}
        <nav className="admin-mobile-nav" aria-label="后台导航">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={isActive(n) ? "active" : ""}>
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>

        <header className="admin-top">
          <div>
            <h1>{current.label}</h1>
            <div className="a-top-sub">好宝宝育儿知识库后台管理系统</div>
          </div>
          <div className="admin-top-spacer" />
          <div className="admin-user-chip">
            <span className="admin-avatar">{user.nickname.charAt(0).toUpperCase()}</span>
            <b>{user.nickname}</b>
          </div>
          <button className="a-btn a-btn-sm" onClick={logout} title="退出登录">
            退出
          </button>
        </header>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
