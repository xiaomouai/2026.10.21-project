"use client";

import { useState } from "react";

export default function InviteCard({
  code,
  url,
  svg,
  rewardInviter,
  rewardInvitee,
}: {
  code: string;
  url: string;
  svg: string;
  rewardInviter: number;
  rewardInvitee: number;
}) {
  const [toast, setToast] = useState("");

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1900);
  }

  async function copy(text: string, label: string) {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // http 环境 / 旧浏览器兜底
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }
    flash(ok ? `${label}已复制` : "复制失败，请长按手动复制");
  }

  async function share() {
    const text = `我在用「好宝宝育儿知识库」排查宝宝睡眠，通过我的邀请注册，你我都能拿积分～`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "好宝宝育儿知识库", text, url });
        return;
      } catch {
        return; // 用户取消分享
      }
    }
    copy(url, "邀请链接");
  }

  return (
    <div className="invite-card">
      <div className="invite-qr">
        {/* 服务端渲染好的 SVG 二维码，内容为邀请链接 */}
        <div className="invite-qr-img" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="invite-scan-hint">微信扫一扫 · 或长按识别</div>
      </div>

      <div className="invite-code-row">
        <div>
          <div className="invite-code-label">我的邀请码</div>
          <div className="invite-code">{code}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => copy(code, "邀请码")}>
          复制邀请码
        </button>
      </div>

      <div className="invite-link-box">
        <span className="invite-link-text">{url}</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => copy(url, "邀请链接")}
        >
          复制链接
        </button>
      </div>

      <div className="invite-actions">
        <a
          className="btn btn-outline"
          href={`/api/invite/qr?code=${code}&format=png&download=1`}
        >
          ⬇️ 保存二维码
        </a>
        <button className="btn btn-primary" onClick={share}>
          📤 分享给好友
        </button>
      </div>

      <div className="invite-reward-line">
        🎁 好友通过你的邀请注册：你得 <strong>{rewardInviter}</strong> 积分，好友额外得{" "}
        <strong>{rewardInvitee}</strong> 积分
      </div>

      {toast && <div className="invite-toast">{toast}</div>}
    </div>
  );
}
