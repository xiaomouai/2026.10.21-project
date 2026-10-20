"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthModal({
  onClose,
  initialMode = "login",
}: {
  onClose: () => void;
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 挂载后读取邀请码（放 effect 里避免 SSR 与首帧不一致）
  useEffect(() => {
    try {
      const code = localStorage.getItem("kb_invite") || "";
      if (code) {
        setInviteCode(code);
        setMode("register"); // 带邀请码进来默认落在注册
      }
    } catch {
      /* ignore */
    }
  }, []);

  function clearInvite() {
    setInviteCode("");
    try {
      localStorage.removeItem("kb_invite");
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = mode === "login" ? "/api/login" : "/api/register";
    const body =
      mode === "login"
        ? { phone, password }
        : { phone, password, nickname: nickname || undefined, invite: inviteCode || undefined };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "操作失败");
        setLoading(false);
        return;
      }
      // 注册成功且奖励已发放 → 清掉本地邀请码，避免下次误用
      if (mode === "register") clearInvite();
      onClose();
      router.refresh();
    } catch (e) {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <h3 style={{ margin: 0 }}>
            {mode === "login" ? "登录" : "注册"} · 育儿知识库
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div className="cats" style={{ marginBottom: 18 }}>
          <button
            className={`cat-chip ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}
          >
            登录
          </button>
          <button
            className={`cat-chip ${mode === "register" ? "active" : ""}`}
            onClick={() => switchMode("register")}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && inviteCode && (
            <div className="invite-chip" style={{ marginBottom: 14 }}>
              <span>🎁 好友邀请码</span>
              <strong>{inviteCode}</strong>
              <button type="button" onClick={clearInvite} aria-label="不使用邀请码">
                ✕
              </button>
            </div>
          )}

          {mode === "register" && (
            <div className="form-group">
              <label>昵称</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="如：新手妈妈小雅"
              />
            </div>
          )}
          <div className="form-group">
            <label>手机号</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="请输入手机号"
              required
            />
          </div>
          <div className="form-group">
            <label>密码（至少6位）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              minLength={6}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册并领取积分"}
          </button>
        </form>

        <div className="divider" />

        <div className="alert alert-info" style={{ margin: 0 }}>
          🎁 <strong>免费体验</strong>：注册即赠积分，可阅读全部免费教程、每日打卡赚积分、论坛发帖互动。
          <br />
          <span className="hint">演示账号：13800001234 / 123456</span>
        </div>
      </div>
    </div>
  );
}
