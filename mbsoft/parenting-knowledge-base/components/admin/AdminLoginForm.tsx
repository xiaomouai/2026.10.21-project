"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        setBusy(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("网络异常，请重试");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="a-field">
        <label htmlFor="admin-email">管理员邮箱</label>
        <input
          id="admin-email"
          className="a-input"
          type="email"
          autoComplete="username"
          placeholder="admin@test.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="a-field">
        <label htmlFor="admin-password">密码</label>
        <input
          id="admin-password"
          className="a-input"
          type="password"
          autoComplete="current-password"
          placeholder="请输入密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <div className="a-alert a-alert-err">{error}</div>}

      <button className="a-btn a-btn-primary" style={{ width: "100%" }} type="submit" disabled={busy}>
        {busy ? "登录中…" : "登录后台"}
      </button>
    </form>
  );
}
