"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LlmConfig, SiteSettings } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

type Preset = { label: string; baseUrl: string; models: string[] };

export default function LlmSettingsForm({
  llm,
  site,
  presets,
  hasApiKey,
}: {
  llm: LlmConfig;
  site: SiteSettings;
  presets: Record<string, Preset>;
  hasApiKey: boolean;
}) {
  const router = useRouter();

  // 表单：apiKey 留空表示「保持原值不变」
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [clearKey, setClearKey] = useState(false);
  const [cfg, setCfg] = useState({
    enabled: llm.enabled,
    provider: llm.provider,
    baseUrl: llm.baseUrl,
    model: llm.model,
    temperature: llm.temperature,
    maxTokens: llm.maxTokens,
    systemPrompt: llm.systemPrompt,
  });
  const [siteCfg, setSiteCfg] = useState(site);

  const [busy, setBusy] = useState<"" | "llm" | "site" | "test">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string; cost?: number; reply?: string } | null>(null);

  const preset = presets[cfg.provider];

  function pickProvider(key: string) {
    const p = presets[key];
    setCfg((c) => ({
      ...c,
      provider: key as LlmConfig["provider"],
      baseUrl: p?.baseUrl || c.baseUrl,
      model: p?.models?.[0] || c.model,
    }));
  }

  function llmPayload() {
    const payload: Record<string, unknown> = { ...cfg };
    // 留空 = 不修改；勾选清除 = 显式置空
    if (clearKey) payload.apiKey = "";
    else if (apiKey.trim()) payload.apiKey = apiKey.trim();
    return payload;
  }

  async function saveLlm() {
    setBusy("llm");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm: llmPayload() }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: data.message } : { ok: false, text: data.error || "保存失败" });
      if (res.ok) {
        setApiKey("");
        setClearKey(false);
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "网络异常，请重试" });
    } finally {
      setBusy("");
    }
  }

  async function saveSite() {
    setBusy("site");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: siteCfg }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: data.message } : { ok: false, text: data.error || "保存失败" });
      if (res.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "网络异常，请重试" });
    } finally {
      setBusy("");
    }
  }

  async function testConnection() {
    setBusy("test");
    setTestResult(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm: llmPayload() }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          text: `连接成功 · 模型 ${data.model}`,
          cost: data.cost,
          reply: data.reply,
        });
      } else {
        setTestResult({ ok: false, text: data.error || "连接失败", cost: data.cost });
      }
    } catch {
      setTestResult({ ok: false, text: "网络异常，请重试" });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="a-stack">
      {msg && <div className={`a-alert ${msg.ok ? "a-alert-ok" : "a-alert-err"}`}>{msg.text}</div>}

      {/* ---------- 大模型配置 ---------- */}
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>大模型配置</h2>
            <div className="a-card-sub">
              用于智能答疑、内容生成等 AI 能力；接口按 OpenAI 兼容协议调用
            </div>
          </div>
          <div className="a-card-head-spacer" />
          <span className={`a-badge ${cfg.enabled ? "a-badge-green" : ""}`}>
            {cfg.enabled ? "● 已启用" : "○ 未启用"}
          </span>
        </div>

        <label className="a-switch" style={{ marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          <span className="a-switch-track" />
          启用大模型能力
        </label>
        <div className="a-tip">
          启用并配置密钥后，前台登录用户将看到「💬 AI 育儿助手」浮窗：可基于知识库答疑、帮用户打卡、代发论坛求助（接口按 OpenAI 兼容协议调用）。<br />
          <b>额度规则</b>：年度会员不限次；其他用户（含月卡）仅 1 次免费体验，用完后提示开通会员。额度按「模型实际产出内容」计数，请求失败不计费。
        </div>

        <div className="a-row">
          <div className="a-field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="llm-provider">供应商</label>
            <select
              id="llm-provider"
              className="a-select"
              value={cfg.provider}
              onChange={(e) => pickProvider(e.target.value)}
            >
              {Object.entries(presets).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="a-field" style={{ flex: "1 1 320px" }}>
            <label htmlFor="llm-base">Base URL</label>
            <input
              id="llm-base"
              className="a-input"
              value={cfg.baseUrl}
              onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
            />
            <div className="a-tip">实际请求地址为 <code>{cfg.baseUrl || "<Base URL>"}/chat/completions</code></div>
          </div>
        </div>

        <div className="a-field">
          <label htmlFor="llm-key">API Key</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="llm-key"
              className="a-input"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              value={clearKey ? "" : apiKey}
              disabled={clearKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                clearKey ? "保存后将清空密钥" : hasApiKey ? "已保存密钥，留空表示不修改" : "sk-...（尚未配置）"
              }
            />
            <button className="a-btn" type="button" onClick={() => setShowKey((v) => !v)} disabled={clearKey}>
              {showKey ? "隐藏" : "显示"}
            </button>
            {hasApiKey && (
              <button
                className={`a-btn ${clearKey ? "a-btn-danger" : ""}`}
                type="button"
                onClick={() => setClearKey((v) => !v)}
              >
                {clearKey ? "取消清除" : "清除密钥"}
              </button>
            )}
          </div>
          <div className="a-tip">
            {hasApiKey ? "安全提示：密钥仅保存在服务端数据库，页面不回显明文。" : "密钥将以明文存于本地 SQLite 的 settings 表，生产环境建议改用环境变量。"}
          </div>
        </div>

        <div className="a-row">
          <div className="a-field" style={{ flex: "1 1 240px" }}>
            <label htmlFor="llm-model">模型名称</label>
            <input
              id="llm-model"
              className="a-input"
              list="model-list"
              value={cfg.model}
              onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
            />
            <datalist id="model-list">
              {(preset?.models ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="a-field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="llm-temp">温度（0 ~ 2）：{cfg.temperature}</label>
            <input
              id="llm-temp"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={cfg.temperature}
              onChange={(e) => setCfg({ ...cfg, temperature: Number(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>
          <div className="a-field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="llm-max">最大输出长度</label>
            <input
              id="llm-max"
              className="a-input"
              type="number"
              min={1}
              max={32768}
              value={cfg.maxTokens}
              onChange={(e) => setCfg({ ...cfg, maxTokens: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="a-field">
          <label htmlFor="llm-sys">系统提示词</label>
          <textarea
            id="llm-sys"
            className="a-textarea"
            style={{ minHeight: 90 }}
            value={cfg.systemPrompt}
            onChange={(e) => setCfg({ ...cfg, systemPrompt: e.target.value })}
          />
        </div>

        {llm.updatedAt && (
          <div className="a-muted" style={{ marginBottom: 12 }}>
            上次保存：{formatDateTime(llm.updatedAt)}
            {llm.updatedBy && ` · ${llm.updatedBy}`}
          </div>
        )}

        {testResult && (
          <div className={`a-alert ${testResult.ok ? "a-alert-ok" : "a-alert-err"}`}>
            <b>{testResult.ok ? "✅ " : "❌ "}</b>
            {testResult.text}
            {typeof testResult.cost === "number" && ` · 耗时 ${testResult.cost} ms`}
            {testResult.reply && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>模型返回：{testResult.reply}</div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="a-btn a-btn-primary" disabled={busy !== ""} onClick={saveLlm}>
            {busy === "llm" ? "保存中…" : "保存配置"}
          </button>
          <button className="a-btn" disabled={busy !== ""} onClick={testConnection}>
            {busy === "test" ? "测试中…" : "🔌 测试连接"}
          </button>
        </div>
      </div>

      {/* ---------- 站点运营设置 ---------- */}
      <div className="a-card">
        <div className="a-card-head">
          <div>
            <h2>站点与积分规则</h2>
            <div className="a-card-sub">影响前台注册赠送、打卡、发帖与邀请好友的积分发放</div>
          </div>
        </div>

        <div className="a-row">
          <div className="a-field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="s-name">站点名称</label>
            <input
              id="s-name"
              className="a-input"
              value={siteCfg.siteName}
              onChange={(e) => setSiteCfg({ ...siteCfg, siteName: e.target.value })}
            />
          </div>
          <div className="a-field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="s-reg">注册赠送积分</label>
            <input
              id="s-reg"
              className="a-input"
              type="number"
              min={0}
              value={siteCfg.registerBonus}
              onChange={(e) => setSiteCfg({ ...siteCfg, registerBonus: Number(e.target.value) })}
            />
          </div>
          <div className="a-field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="s-check">每日打卡积分</label>
            <input
              id="s-check"
              className="a-input"
              type="number"
              min={0}
              value={siteCfg.checkInPoints}
              onChange={(e) => setSiteCfg({ ...siteCfg, checkInPoints: Number(e.target.value) })}
            />
          </div>
          <div className="a-field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="s-post">发帖奖励积分</label>
            <input
              id="s-post"
              className="a-input"
              type="number"
              min={0}
              value={siteCfg.postPoints}
              onChange={(e) => setSiteCfg({ ...siteCfg, postPoints: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="a-row">
          <div className="a-field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="s-inviter">邀请人奖励积分</label>
            <input
              id="s-inviter"
              className="a-input"
              type="number"
              min={0}
              value={siteCfg.inviteRewardInviter}
              onChange={(e) => setSiteCfg({ ...siteCfg, inviteRewardInviter: Number(e.target.value) })}
            />
            <div className="a-tip">好友通过邀请链接注册成功后奖励给邀请人</div>
          </div>
          <div className="a-field" style={{ flex: "1 1 200px" }}>
            <label htmlFor="s-invitee">被邀请人奖励积分</label>
            <input
              id="s-invitee"
              className="a-input"
              type="number"
              min={0}
              value={siteCfg.inviteRewardInvitee}
              onChange={(e) => setSiteCfg({ ...siteCfg, inviteRewardInvitee: Number(e.target.value) })}
            />
            <div className="a-tip">额外叠加在「注册赠送积分」之上发放</div>
          </div>
        </div>

        <div className="a-field">
          <label htmlFor="s-ann">站点公告（留空则不展示）</label>
          <textarea
            id="s-ann"
            className="a-textarea"
            style={{ minHeight: 70 }}
            value={siteCfg.announcement}
            onChange={(e) => setSiteCfg({ ...siteCfg, announcement: e.target.value })}
            placeholder="例如：本周末将上线「夜奶戒断」专题课，敬请期待"
          />
        </div>

        <button className="a-btn a-btn-primary" disabled={busy !== ""} onClick={saveSite}>
          {busy === "site" ? "保存中…" : "保存站点设置"}
        </button>
      </div>
    </div>
  );
}
