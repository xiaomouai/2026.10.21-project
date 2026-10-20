"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

interface Me {
  id: number;
  username: string;
  email: string | null;
  expires_at: string;
  status: string;
  note: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          router.replace("/auth");
          return;
        }
        setUser(d);
        setLoading(false);
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth");
    router.refresh();
  };

  if (loading || !user) {
    return (
      <div className="app-container page-with-nav" style={{ padding: 24 }}>
        加载中...
      </div>
    );
  }

  const expired = new Date(user.expires_at).getTime() < Date.now();

  return (
    <div className="app-container page-with-nav">
      <header className="app-header">
        <h1>👤 个人中心</h1>
        <p>账户与有效期</p>
      </header>

      <div className="card">
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1677ff, #4096ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              fontSize: 28,
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{user.username}</h2>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📋 账户信息</div>
        <div className="result-box" style={{ background: "#fff" }}>
          <div className="result-row">
            <span className="label">用户名</span>
            <span className="value">{user.username}</span>
          </div>
          <div className="result-row">
            <span className="label">邮箱</span>
            <span className="value">{user.email || "-"}</span>
          </div>
          <div className="result-row">
            <span className="label">使用状态</span>
            <span className="value">
              <span className={expired ? "badge badge-bad" : "badge badge-ok"}>
                {expired ? "已过期" : "有效"}
              </span>
            </span>
          </div>
          <div className="result-row">
            <span className="label">到期时间</span>
            <span className="value">
              {new Date(user.expires_at).toLocaleString("zh-CN", {
                hour12: false,
              })}
            </span>
          </div>
          {user.note && (
            <div className="result-row">
              <span className="label">备注</span>
              <span className="value">{user.note}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 16px 24px" }}>
        <button
          className="btn btn-outline"
          onClick={handleLogout}
          style={{
            borderColor: "var(--color-danger)",
            color: "var(--color-danger)",
          }}
        >
          🚪 退出登录
        </button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}
