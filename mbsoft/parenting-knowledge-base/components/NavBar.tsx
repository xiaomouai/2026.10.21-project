"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthModal from "./AuthModal";
import CheckInButton from "./CheckInButton";
import SurveyModal from "./SurveyModal";
import ChatWidget from "./ChatWidget";
import { getAccessTier, maskPhone } from "@/lib/access";

const NAV_LINKS = [
  { href: "/topics", label: "教程", icon: "📚" },
  { href: "/forum", label: "论坛", icon: "💬" },
  { href: "/checkin", label: "打卡", icon: "📅" },
  { href: "/membership", label: "会员", icon: "💎" },
  { href: "/invite", label: "邀请", icon: "🎁" },
];

export default function NavBar({
  user,
  checkedToday,
}: {
  user: any;
  checkedToday: boolean;
}) {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showSurvey, setShowSurvey] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // 后台页面使用独立外壳：前台导航（含底部 Tab）不渲染，也不弹调研
  const isAdminRoute = pathname.startsWith("/admin");
  const loggedIn = !!user;
  // 会员层级（过期自动降级为 free），用于导航徽标
  const tier = getAccessTier(user);

  // 登录用户若无宝宝档案，自动弹出调研（每次会话最多弹一次，可跳过）
  useEffect(() => {
    if (isAdminRoute) return;
    if (user && !user.childProfile && !sessionStorage.getItem("survey_skipped")) {
      setShowSurvey(true);
    }
  }, [user?.id, !!user?.childProfile, isAdminRoute]);

  // 点击菜单外区域自动收起下拉
  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  // 通过邀请链接进入（?invite=CODE）：存下邀请码（供 AuthModal 读取）并自动弹出注册弹窗。
  // 直接读 window.location，避免依赖 useSearchParams 的 Suspense 约束与跨组件事件时序。
  useEffect(() => {
    if (isAdminRoute || loggedIn) return;
    const raw = new URLSearchParams(window.location.search).get("invite");
    const code = (raw || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) return;
    try {
      localStorage.setItem("kb_invite", code);
    } catch {
      /* ignore */
    }
    setAuthMode("register");
    setShowAuth(true);
  }, [isAdminRoute, loggedIn]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setMenuOpen(false);
    router.refresh();
  }

  if (isAdminRoute) return null;

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-brand">
            🌙 好宝宝育儿知识库
          </Link>
          <div className="nav-links">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="nav-spacer" />
          {user ? (
            <div className="nav-user">
              <CheckInButton checkedToday={checkedToday} />
              <span className="points-badge">⭐ {user.points}</span>
              {tier === "full" ? (
                <Link href="/membership" className="points-badge" style={{ textDecoration: "none", background: "linear-gradient(135deg,#ede9fe,#dbeafe)" }} title="年卡会员">👑 年卡</Link>
              ) : tier === "basic" ? (
                <Link href="/membership" className="points-badge" style={{ textDecoration: "none", background: "linear-gradient(135deg,#e0f2fe,#ecfeff)" }} title="月卡会员">⭐ 月卡</Link>
              ) : (
                <Link href="/membership" className="points-badge" style={{ textDecoration: "none" }} title="激活会员">🔒 激活</Link>
              )}
              <div style={{ position: "relative" }} ref={menuRef}>
                <button
                  className="avatar"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="用户菜单"
                  title={user.nickname}
                >
                  {user.nickname.charAt(0).toUpperCase()}
                </button>
                {menuOpen && (
                  <div className="user-menu">
                    <div style={{ padding: "8px 12px", fontSize: 13, color: "var(--muted)", wordBreak: "break-all" }}>
                      {user.phone ? maskPhone(user.phone) : user.email}
                    </div>
                    <div className="divider" style={{ margin: "4px 0" }} />
                    <button
                      className="menu-item"
                      style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => {
                        setMenuOpen(false);
                        setShowSurvey(true);
                      }}
                    >
                      👶 宝宝档案{user.childProfile ? "" : " · 未填写"}
                    </button>
                    <Link href="/membership" onClick={() => setMenuOpen(false)}>
                      💎 我的会员 / 激活
                    </Link>
                    <Link href="/invite" onClick={() => setMenuOpen(false)}>
                      🎁 邀请好友赚积分
                    </Link>
                    <button className="menu-logout" onClick={logout}>
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAuthMode("login");
                setShowAuth(true);
              }}
            >
              登录 / 注册
            </button>
          )}
        </div>
      </nav>

      {/* 移动端底部 Tab 栏（CSS 控制仅 <700px 显示） */}
      <nav className="tabbar" aria-label="底部导航">
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
            <span className="tab-icon" aria-hidden>{l.icon}</span>
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>

      {showAuth && (
        <AuthModal initialMode={authMode} onClose={() => setShowAuth(false)} />
      )}
      {showSurvey && (
        <SurveyModal
          skippable={!user?.childProfile}
          onClose={() => setShowSurvey(false)}
        />
      )}
      {user && <ChatWidget />}
    </>
  );
}
