"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SurveyModal from "@/components/SurveyModal";
import { maskPhone, tierLabel, membershipLabel } from "@/lib/access";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

type Profile = {
  nickname: string;
  phone: string;
  points: number;
  childProfile: any;
  membership: { type: string; tier: string; until?: string; daysLeft: number; active: boolean };
};

export default function MembershipPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);

  async function load() {
    const res = await fetch("/api/profile");
    if (res.status === 401) {
      router.push("/?auth=login");
      return;
    }
    const d = await res.json();
    setProfile(d);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redeem() {
    if (!code.trim()) {
      setMsg({ ok: false, text: "请输入授权卡密钥" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || "兑换失败" });
        return;
      }
      setMsg({ ok: true, text: d.message });
      setCode("");
      await load();
    } catch {
      setMsg({ ok: false, text: "网络异常，请重试" });
    } finally {
      setBusy(false);
    }
  }

  if (!profile) {
    return <div className="card center muted">加载中…</div>;
  }

  const m = profile.membership;
  const isFull = m.tier === "full";
  const isBasic = m.tier === "basic";

  return (
    <div className="stack-md" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginTop: 18 }}>💎 我的会员</h1>

      {msg && (
        <div className={`alert ${msg.ok ? "alert-info" : "alert-error"}`}>{msg.text}</div>
      )}

      {/* 当前会员状态 */}
      <div
        className="card"
        style={{
          background: isFull
            ? "linear-gradient(135deg,#ede9fe,#dbeafe)"
            : isBasic
            ? "linear-gradient(135deg,#e0f2fe,#ecfeff)"
            : "linear-gradient(135deg,#fef3c7,#fce7f3)",
          border: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{isFull ? "👑" : isBasic ? "⭐" : "🆓"}</span>
          <div>
            <strong style={{ fontSize: 16 }}>{tierLabel(m.tier as any)}</strong>
            <div className="muted" style={{ fontSize: 13 }}>
              {m.active && m.until
                ? `有效期至 ${m.until.slice(0, 10)} · 剩余 ${m.daysLeft} 天`
                : "尚未激活会员，仅可试读摘要"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13 }} className="muted">
          <span>👤 {profile.nickname}</span>
          <span>📱 {maskPhone(profile.phone)}</span>
          <span>⭐ {profile.points} 积分</span>
        </div>
      </div>

      {/* 兑换授权卡 */}
      <div className="card">
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>激活会员（输入授权卡密钥）</h3>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          向管理员获取授权卡密钥（如 <code>KB1M-A1B2C3D4</code>），月卡激活 30 天、年卡激活 365 天。已激活同类会员会在到期时间上顺延。
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="search"
            style={{ flex: 1 }}
            placeholder="请输入授权卡密钥"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn-primary" disabled={busy} onClick={redeem}>
            {busy ? "兑换中…" : "激活"}
          </button>
        </div>
      </div>

      {/* 权益说明 */}
      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>权益对照</h3>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fce7f3" }}>
                <th style={{ padding: 10, textAlign: "left" }}>内容</th>
                <th style={{ padding: 10, textAlign: "center" }}>免费</th>
                <th style={{ padding: 10, textAlign: "center" }}>月卡</th>
                <th style={{ padding: 10, textAlign: "center" }}>年卡</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["普内容（非付费教程）", "试读", "✅", "✅"],
                ["全部内容（含付费）", "🔒", "🔒", "✅"],
                ["打卡积分", "✅", "✅", "✅"],
                ["论坛互动", "✅", "✅", "✅"],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: 10,
                        textAlign: j === 0 ? "left" : "center",
                        fontWeight: j === 0 ? 600 : 400,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 宝宝档案 */}
      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0, fontSize: 16 }}>👶 宝宝档案</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setShowSurvey(true)}>
            {profile.childProfile ? "编辑" : "填写"}
          </button>
        </div>
        {profile.childProfile ? (
          <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
            月龄段：{profile.childProfile.ageBand}
            {profile.childProfile.pains?.length > 0 && ` · 困扰：${profile.childProfile.pains.join("、")}`}
            <br />
            用于个性化推荐教程，可随时修改。
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
            尚未填写，填写后可获得专属推荐。
          </p>
        )}
      </div>

      {showSurvey && <SurveyModal skippable onClose={() => { setShowSurvey(false); load(); }} />}
    </div>
  );
}
