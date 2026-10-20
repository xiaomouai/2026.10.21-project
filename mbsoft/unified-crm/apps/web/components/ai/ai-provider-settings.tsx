"use client";

import { useState, useTransition } from "react";
import { saveLlmConfig, resetLlmConfig } from "../../lib/actions/llmConfig";
import type { LlmConfigView, SaveLlmInput } from "../../lib/actions/llmConfig";
import { Card, Badge, Field, inputClass, buttonClass } from "../ui/primitives";

/**
 * 模型供应商配置表单 [CONFIG]
 *
 * 直接在界面配置大模型通道（供应商 / Key / 模型 / 自定义端点），
 * 存入数据库 AppConfig.llm，保存即生效 —— 无需改后端 .env、无需重启。
 * Key 永不明文回显（仅尾 4 位），留空表示保留已保存值。
 */

type ProviderValue = SaveLlmInput["provider"];

type ProviderOption = {
  value: ProviderValue;
  label: string;
  desc: string;
  keyField?: keyof SaveLlmInput["keys"];
  keyLabel?: string;
  keyPlaceholder?: string;
  needsBaseUrl?: boolean;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: "dashscope",
    label: "通义千问 Qwen",
    desc: "阿里云百炼 DashScope 兼容模式 · 默认 qwen-plus",
    keyField: "dashscope",
    keyLabel: "DASHSCOPE_API_KEY",
    keyPlaceholder: "sk-xxxxxxxx",
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    desc: "DeepSeek 官方 API · 默认 deepseek-chat",
    keyField: "deepseek",
    keyLabel: "DEEPSEEK_API_KEY",
    keyPlaceholder: "sk-xxxxxxxx",
  },
  {
    value: "openai",
    label: "OpenAI",
    desc: "OpenAI 官方 API · 默认 gpt-4o-mini",
    keyField: "openai",
    keyLabel: "OPENAI_API_KEY",
    keyPlaceholder: "sk-xxxxxxxx",
  },
  {
    value: "custom",
    label: "自定义兼容端点",
    desc: "任意 OpenAI 兼容服务（vLLM / Ollama / 中转等）",
    keyField: "custom",
    keyLabel: "AI_API_KEY",
    keyPlaceholder: "任意兼容 Key",
    needsBaseUrl: true,
  },
  {
    value: "off",
    label: "关闭 LLM",
    desc: "纯本地规则引擎（演示 / 零成本模式）",
  },
];

const DEFAULT_MODEL_PLACEHOLDER: Record<string, string> = {
  dashscope: "qwen-plus（可填 qwen-max / qwen-turbo）",
  deepseek: "deepseek-chat（可填 deepseek-reasoner）",
  openai: "gpt-4o-mini",
  custom: "模型名，如 qwen2.5-32b-instruct",
};

export function AiProviderSettings({ slug, initial }: { slug: string; initial: LlmConfigView }) {
  const [view, setView] = useState<LlmConfigView>(initial);
  const [provider, setProvider] = useState<ProviderValue>(
    initial.stored?.provider ?? (initial.effective.off ? "off" : initial.effective.provider || ""),
  );
  const [model, setModel] = useState(initial.stored?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(initial.stored?.baseUrl ?? "");
  const [keys, setKeys] = useState<SaveLlmInput["keys"]>({
    dashscope: "",
    deepseek: "",
    openai: "",
    custom: "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const opt = PROVIDER_OPTIONS.find((o) => o.value === provider);
  const keyMasked = opt?.keyField ? view.masked[opt.keyField] : "";

  /** 用 action 返回的新视图重置表单（清空明文输入） */
  function applyView(v: LlmConfigView) {
    setView(v);
    setProvider(v.stored?.provider ?? (v.effective.off ? "off" : v.effective.provider || ""));
    setModel(v.stored?.model ?? "");
    setBaseUrl(v.stored?.baseUrl ?? "");
    setKeys({ dashscope: "", deepseek: "", openai: "", custom: "" });
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await saveLlmConfig({ provider, model, baseUrl, keys }, slug);
      if (r.ok && r.view) {
        applyView(r.view);
        setMsg({ ok: true, text: "已保存，立即生效（无需重启）" });
      } else {
        setMsg({ ok: false, text: r.error || "保存失败" });
      }
    });
  }

  function reset() {
    setMsg(null);
    startTransition(async () => {
      const r = await resetLlmConfig(slug);
      if (r.ok && r.view) {
        applyView(r.view);
        setMsg({ ok: true, text: "已清除界面配置，回到后端环境变量默认" });
      } else {
        setMsg({ ok: false, text: r.error || "重置失败" });
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-medium text-slate-900">模型供应商配置</h3>
        <Badge tone="green">保存即生效</Badge>
        <Badge tone="slate">仅所有者/管理员</Badge>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
        直接在界面配置大模型通道，存入数据库，保存后立即生效 —— 无需改后端 .env、无需重启。
        从未在界面配置过时，沿用后端环境变量（UCRM_LLM_PROVIDER / DASHSCOPE_API_KEY 等）。
      </p>

      {/* 当前生效状态 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <span>当前生效：</span>
        <Badge tone={view.effective.off || !view.effective.available ? "amber" : "green"}>
          {view.effective.off ? "已关闭（规则引擎）" : view.effective.available ? "LLM 模式" : "降级（无 Key）"}
        </Badge>
        <span className="font-medium text-slate-900">
          {view.effective.provider ? view.effective.provider.toUpperCase() : "—"} · {view.effective.model}
        </span>
        <span className="text-slate-400">
          来源：{view.effective.source === "db" ? "界面配置" : "环境变量"}
        </span>
      </div>

      {/* 供应商单选 */}
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {PROVIDER_OPTIONS.map((o) => (
          <label
            key={o.value || "none"}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition ${
              provider === o.value
                ? "border-indigo-300 bg-indigo-50/60"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="llm-provider"
              className="mt-1"
              checked={provider === o.value}
              onChange={() => setProvider(o.value)}
            />
            <span>
              <span className="block text-[13px] font-medium text-slate-900">{o.label}</span>
              <span className="block text-[11px] leading-snug text-slate-500">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>

      {/* 选中供应商的配置项 */}
      {opt?.keyField && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label={`API Key（${opt.keyLabel}）`}>
            <input
              type="password"
              autoComplete="off"
              className={inputClass}
              value={keys[opt.keyField]}
              onChange={(e) => setKeys((k) => ({ ...k, [opt.keyField!]: e.target.value }))}
              placeholder={keyMasked ? `已保存 ${keyMasked}，输入新值覆盖` : (opt.keyPlaceholder ?? "")}
            />
          </Field>
          <Field label="模型（可选，覆盖默认）">
            <input
              className={inputClass}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL_PLACEHOLDER[opt.value] ?? "模型名"}
            />
          </Field>
        </div>
      )}

      {opt?.needsBaseUrl && (
        <div className="mt-3">
          <Field label="Base URL（OpenAI 兼容端点，必填）">
            <input
              className={inputClass}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-endpoint.example.com/v1"
            />
          </Field>
        </div>
      )}

      {/* 操作按钮与反馈 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className={buttonClass("indigo", "sm")} onClick={save} disabled={pending}>
          {pending ? "保存中…" : "保存配置"}
        </button>
        {view.stored && (
          <button className={buttonClass("slate", "sm")} onClick={reset} disabled={pending}>
            清除界面配置（回到 .env 默认）
          </button>
        )}
        {msg && (
          <span className={`text-[12px] ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>
            {msg.text}
          </span>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        说明：Key 以明文存于本系统数据库（自托管部署约定），界面仅回显尾 4 位，留空表示保留已保存值；
        切换供应商后旧 Key 仍保留在库中，可随时切回。环境变量始终作为兜底默认。
      </p>
    </Card>
  );
}
