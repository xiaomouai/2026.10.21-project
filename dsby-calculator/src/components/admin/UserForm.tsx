"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    amount: "",
    duration_days: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setError("");
    setOk(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk(false);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        password: form.password,
        email: form.email,
        amount: form.amount,
        duration_days: form.duration_days,
        note: form.note,
      }),
    });
    if (res.ok) {
      setOk(true);
      setForm({ username: "", password: "", email: "", amount: "", duration_days: "", note: "" });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "创建失败");
    }
  };

  return (
    <form className="admin-form admin-form-grid" onSubmit={submit}>
      <input
        placeholder="用户名"
        value={form.username}
        onChange={(e) => set("username", e.target.value)}
      />
      <input
        type="password"
        placeholder="密码(至少6位)"
        value={form.password}
        onChange={(e) => set("password", e.target.value)}
      />
      <input
        placeholder="邮箱(可选)"
        value={form.email}
        onChange={(e) => set("email", e.target.value)}
      />
      <input
        type="number"
        placeholder="充值金额"
        value={form.amount}
        onChange={(e) => set("amount", e.target.value)}
      />
      <input
        type="number"
        placeholder="使用时长(天)"
        value={form.duration_days}
        onChange={(e) => set("duration_days", e.target.value)}
      />
      <input
        placeholder="备注(可选)"
        value={form.note}
        onChange={(e) => set("note", e.target.value)}
      />
      <button className="btn btn-primary" type="submit">
        创建用户并充值
      </button>
      {ok && <span className="admin-form-ok">✓ 已创建</span>}
      {error && <span className="admin-form-err">{error}</span>}
    </form>
  );
}
