"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key: "username" | "password", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (form.password.length < 6) {
      setError("密码至少6位");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "登录失败");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-logo">
        <h1>💧 打水计算器</h1>
        <p> 专业套利工具</p>
      </div>

      <div className="auth-card">
        <h2>用户登录</h2>
        <p className="subtitle">登录以使用打水计算器</p>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>

          <div className="form-row">
            <label>密码</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder="至少6位密码"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "⏳ 登录中..." : "🔑 登录"}
          </button>
        </form>

        <div className="auth-footer">
          <a href="/admin/login">我是管理员</a>
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 24 }}>
        © 2026 技术支持：jwj100w· 仅供计算参考
      </p>
    </div>
  );
}
