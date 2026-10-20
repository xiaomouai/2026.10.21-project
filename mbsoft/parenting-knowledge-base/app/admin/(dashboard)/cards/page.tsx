"use client";

import { useEffect, useState } from "react";

type CardRow = {
  id: string;
  code: string;
  tier: "month" | "year";
  status: "unused" | "used";
  usedByNickname?: string;
  usedByPhone?: string;
  usedAt?: string;
  batch?: string;
  createdAt: string;
};

export default function AdminCardsPage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [stats, setStats] = useState({ unused: 0, used: 0, total: 0 });
  const [tier, setTier] = useState<"month" | "year">("month");
  const [count, setCount] = useState(5);
  const [batch, setBatch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCodes, setShowCodes] = useState(true);

  async function load() {
    const res = await fetch("/api/admin/cards");
    const d = await res.json();
    if (res.ok) {
      setCards(d.cards);
      setStats(d.stats);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, count, batch: batch || undefined }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || "生成失败" });
        return;
      }
      setMsg({ ok: true, text: d.message });
      await load();
    } catch {
      setMsg({ ok: false, text: "网络异常" });
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    try {
      navigator.clipboard.writeText(text);
      setMsg({ ok: true, text: `已复制密钥 ${text}` });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="a-stack">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🎫</span>
          <span className="stat-label">授权卡总量</span>
          <span className="stat-value">{stats.total}<small>张</small></span>
          <span className="stat-delta">月度 / 年度混合</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>🟢</span>
          <span className="stat-label">未使用</span>
          <span className="stat-value">{stats.unused}<small>张</small></span>
          <span className="stat-delta">可继续发放</span>
        </div>
        <div className="stat-card">
          <span className="stat-ico" aria-hidden>✅</span>
          <span className="stat-label">已兑换</span>
          <span className="stat-value">{stats.used}<small>张</small></span>
          <span className="stat-delta">已激活会员</span>
        </div>
      </div>

      {msg && <div className={`a-alert ${msg.ok ? "a-alert-ok" : "a-alert-err"}`}>{msg.text}</div>}

      <div className="a-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>生成授权卡</h3>
        <div className="a-row">
          <div className="a-field" style={{ flex: "0 0 160px" }}>
            <label>卡类型</label>
            <select className="a-select" value={tier} onChange={(e) => setTier(e.target.value as any)}>
              <option value="month">月度会员（30天）</option>
              <option value="year">年度会员（365天）</option>
            </select>
          </div>
          <div className="a-field" style={{ flex: "0 0 120px" }}>
            <label>数量</label>
            <input
              className="a-input"
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Math.min(200, Math.max(1, parseInt(e.target.value || "1", 10))))}
            />
          </div>
          <div className="a-field" style={{ flex: 1 }}>
            <label>批次备注（选填）</label>
            <input
              className="a-input"
              placeholder="如：双11推广 / 渠道A"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="a-btn a-btn-primary" disabled={busy} onClick={generate}>
              {busy ? "生成中…" : "批量生成"}
            </button>
          </div>
        </div>
        <div className="a-tip" style={{ marginTop: 10 }}>
          密钥格式如 <code>KB1M-A1B2C3D4</code>（月）/ <code>KB1Y-A1B2C3D4</code>（年）。生成后发给用户，用户在「我的会员」页输入即可激活对应时长会员。
        </div>
      </div>

      <div className="a-card">
        <div className="a-toolbar">
          <h3 style={{ margin: 0, fontSize: 15 }}>授权卡列表</h3>
          <label className="a-muted" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} />
            显示完整密钥
          </label>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>密钥</th>
                <th className="nowrap">类型</th>
                <th className="nowrap">状态</th>
                <th className="nowrap">批次</th>
                <th className="nowrap">兑换人</th>
                <th className="nowrap">生成时间</th>
                <th className="nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td className="a-mono">
                    {showCodes ? c.code : c.code.slice(0, 6) + "••••••••"}
                  </td>
                  <td className="nowrap">
                    {c.tier === "year" ? (
                      <span className="a-badge a-badge-violet">年度</span>
                    ) : (
                      <span className="a-badge a-badge-amber">月度</span>
                    )}
                  </td>
                  <td className="nowrap">
                    {c.status === "used" ? (
                      <span className="a-badge a-badge-green">已兑换</span>
                    ) : (
                      <span className="a-badge">未使用</span>
                    )}
                  </td>
                  <td className="nowrap a-muted">{c.batch || "—"}</td>
                  <td className="nowrap">
                    {c.usedByNickname ? (
                      <>
                        {c.usedByNickname}
                        <div className="a-muted" style={{ fontSize: 12 }}>{c.usedByPhone}</div>
                      </>
                    ) : (
                      <span className="a-muted">—</span>
                    )}
                  </td>
                  <td className="nowrap a-muted">{c.createdAt.slice(0, 10)}</td>
                  <td className="nowrap">
                    <button className="a-btn a-btn-sm" onClick={() => copy(c.code)}>
                      复制
                    </button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr>
                  <td colSpan={7} className="a-empty">还没有生成授权卡</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
