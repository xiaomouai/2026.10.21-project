"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };
// 与服务端 lib/access.ts 的 ChatAccess 对齐：remaining 为 null 表示不限次
type ChatQuota = {
  tier: string;
  unlimited: boolean;
  used: number;
  remaining: number | null;
  allowed: boolean;
};

// 免费额度用尽后的引导文案（服务端拒绝时展示）
const LOCKED_TIP =
  "🔒 你的 AI 助手免费体验次数已用完。\n开通年度会员即可不限次向我提问，还能解锁全站付费教程。";

export default function ChatWidget() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<ChatQuota | null>(null);
  const convRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);

  // 拉取可用性（大模型已启用才会展示入口）+ 当前用户的额度
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => {
        setEnabled(!!d.enabled);
        if (d.chat) setQuota(d.chat);
      })
      .catch(() => setEnabled(false));
  }, []);

  // 额度以服务端为准，每次对话结束后刷新一次
  const refreshQuota = async () => {
    try {
      const r = await fetch("/api/chat");
      const d = await r.json();
      if (d.chat) setQuota(d.chat);
    } catch {
      /* 忽略：保持上一次额度显示 */
    }
  };

  // 打开时恢复最近一次会话
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch("/api/chat");
        const d = await r.json();
        const list = d.conversations || [];
        if (list.length) {
          const cid = list[0].id;
          const mr = await fetch(`/api/chat?conversationId=${encodeURIComponent(cid)}`);
          const md = await mr.json();
          convRef.current = cid;
          setMsgs((md.messages || []).map((m: any) => ({ role: m.role, content: m.content })));
        }
      } catch {
        /* 忽略：直接开新对话 */
      }
    })();
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 1e9 });
  }, [msgs, open, busy]);

  if (enabled === null || enabled === false) return null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    if (quota && !quota.allowed) return; // 免费次数已用完，直接拦在本地
    setInput("");
    setBusy(true);

    const next = [
      ...msgs,
      { role: "user" as const, content: text },
      { role: "assistant" as const, content: "" },
    ];
    setMsgs(next);
    const aiIndex = next.length - 1;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: convRef.current || undefined }),
      });
      // 额度用尽：服务端返回 402 + JSON（不是 SSE 流），在这里转成引导文案
      if (res.status === 402) {
        const info = await res.json().catch(() => ({}));
        if (info.chat) setQuota(info.chat);
        setMsgs((prev) => {
          const c = [...prev];
          c[c.length - 1] = { role: "assistant", content: LOCKED_TIP };
          return c;
        });
        return;
      }
      if (!res.body) throw new Error("无响应");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          try {
            const ev = JSON.parse(data);
            if (ev.type === "meta") {
              convRef.current = ev.conversationId;
            } else if (ev.type === "token") {
              setMsgs((prev) => {
                const c = [...prev];
                c[aiIndex] = { role: "assistant", content: c[aiIndex].content + ev.text };
                return c;
              });
            } else if (ev.type === "quota") {
              setQuota((q) =>
                q
                  ? {
                      ...q,
                      used: ev.used,
                      remaining: ev.remaining,
                      unlimited: !!ev.unlimited,
                      allowed: !!ev.unlimited || (ev.remaining ?? 0) > 0,
                    }
                  : q
              );
            } else if (ev.type === "error") {
              setMsgs((prev) => {
                const c = [...prev];
                c[aiIndex] = { role: "assistant", content: "⚠️ " + ev.message };
                return c;
              });
            }
          } catch {
            /* 跳过无法解析的行 */
          }
        }
      }
    } catch (e: any) {
      setMsgs((prev) => {
        const c = [...prev];
        c[aiIndex] = { role: "assistant", content: "⚠️ 对话失败：" + (e?.message || "") };
        return c;
      });
    } finally {
      setBusy(false);
      refreshQuota(); // 以服务端计数为准，避免前端显示与真实额度不一致
    }
  }

  function newChat() {
    convRef.current = "";
    setMsgs([]);
  }

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="打开 AI 育儿助手">
          💬
        </button>
      )}
      {open && (
        <div className="chat-panel" role="dialog" aria-label="AI 育儿助手">
          <div className="chat-head">
            <span>🤖 AI 育儿助手</span>
            <div className="chat-head-actions">
              {quota && (
                <span className={`chat-quota ${quota.allowed ? "" : "locked"}`}>
                  {quota.unlimited
                    ? "会员不限次"
                    : quota.remaining > 0
                    ? `体验剩 ${quota.remaining} 次`
                    : "额度已用完"}
                </span>
              )}
              <button className="chat-new" onClick={newChat} title="新对话">
                新对话
              </button>
              <button className="chat-close" onClick={() => setOpen(false)} aria-label="关闭">
                ×
              </button>
            </div>
          </div>
          <div className="chat-list" ref={listRef}>
            {msgs.length === 0 && (
              <div className="chat-empty">
                你好，我是好宝宝育儿 AI 助手。可以问我睡眠、喂养、打卡等问题，也可以让我帮你打卡或发帖～
                {quota && !quota.unlimited && (
                  <div className="chat-empty-tip">
                    {quota.allowed
                      ? `当前账户可免费体验 ${quota.remaining} 次，年度会员不限次使用。`
                      : "免费体验次数已用完，开通年度会员后即可不限次提问。"}
                  </div>
                )}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "chat-msg user" : "chat-msg ai"}>
                {m.content || "…"}
              </div>
            ))}
            {busy && <div className="chat-typing">正在思考…</div>}
          </div>
          {quota && !quota.allowed && (
            <div className="chat-upgrade">
              <span>🔒 免费体验次数已用完，开通年度会员即可不限次提问</span>
              <Link href="/pricing" className="chat-upgrade-btn">
                开通会员
              </Link>
            </div>
          )}
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={quota && !quota.allowed ? "已用完，开通会员后继续提问" : "问问 AI 助手…"}
              disabled={busy || (!!quota && !quota.allowed)}
            />
            <button onClick={send} disabled={busy || !input.trim() || (!!quota && !quota.allowed)}>
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
