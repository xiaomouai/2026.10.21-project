"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk(false);
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setOk(true);
      setUsername("");
      setPassword("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "创建失败");
    }
  };

  return (
    <form className="admin-form" onSubmit={submit}>
      <input
        placeholder="管理员用户名"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="密码(至少6位)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="btn btn-primary" type="submit">
        添加管理员
      </button>
      {ok && <span className="admin-form-ok">✓ 已添加</span>}
      {error && <span className="admin-form-err">{error}</span>}
    </form>
  );
}
