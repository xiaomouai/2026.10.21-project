"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/admin");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "登录失败");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-logo">
        <h1>💧 管理后台</h1>
        <p>dsby.org · 管理员登录</p>
      </div>
      <div className="auth-card">
        <h2>管理员登录</h2>
        <p className="subtitle">请输入管理员账号</p>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </div>
          <div className="form-row">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位密码"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="auth-error">⚠️ {error}</div>
          )}
          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading ? "⏳ 登录中..." : "🔑 登录"}
          </button>
        </form>
        <div className="auth-footer">
          <a href="/auth">前往用户登录</a>
        </div>
      </div>
    </div>
  );
}
