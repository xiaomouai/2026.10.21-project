"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = { id: number; username: string };

export default function OrderForm({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk(false);
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        amount,
        duration_days: durationDays,
        note,
      }),
    });
    if (res.ok) {
      setOk(true);
      setAmount("");
      setDurationDays("");
      setNote("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "创建失败");
    }
  };

  return (
    <form className="admin-form admin-form-grid" onSubmit={submit}>
      <select value={userId} onChange={(e) => setUserId(e.target.value)}>
        <option value="">选择用户</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.username}
          </option>
        ))}
      </select>
      <input
        type="number"
        placeholder="充值金额"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        type="number"
        placeholder="使用时长(天)"
        value={durationDays}
        onChange={(e) => setDurationDays(e.target.value)}
      />
      <input
        placeholder="备注(可选)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="btn btn-primary" type="submit">
        创建充值订单
      </button>
      {ok && <span className="admin-form-ok">✓ 已创建</span>}
      {error && <span className="admin-form-err">{error}</span>}
    </form>
  );
}
