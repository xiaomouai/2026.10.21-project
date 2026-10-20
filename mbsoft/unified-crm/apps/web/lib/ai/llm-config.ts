import "server-only";
import {
  getAppConfigRaw,
  LLM_CONFIG_KEY,
  type LlmProvider,
  type LlmStoredConfig,
} from "@ucrm/db";

/**
 * LLM 生效配置解析器 [CONFIG]
 *
 * 优先级：界面配置（数据库 AppConfig.llm）> 环境变量 > 无（降级规则引擎）。
 *  - 界面保存后立即生效（无需改 .env、无需重启容器/进程）
 *  - 环境变量仍作为初始默认值：从未在界面配置过时，行为与旧版完全一致
 *
 * 安全：解析出的 key 仅在服务端内部使用（llmChat / detectAiCapabilities /
 * Server Actions），严禁下发到客户端组件；下发视图一律脱敏（尾 4 位）。
 */

export type LlmProviderName = "openai" | "dashscope" | "deepseek" | "custom";

export const PROVIDER_DEFAULTS: Record<
  LlmProviderName,
  { baseUrl: string; model: string; label: string; keyLabel: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    label: "OpenAI 兼容接口",
    keyLabel: "OPENAI_API_KEY",
  },
  dashscope: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    label: "阿里云百炼（通义千问 Qwen）",
    keyLabel: "DASHSCOPE_API_KEY",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    label: "DeepSeek",
    keyLabel: "DEEPSEEK_API_KEY",
  },
  custom: {
    baseUrl: "",
    model: "gpt-4o-mini",
    label: "自定义 OpenAI 兼容端点",
    keyLabel: "AI_API_KEY",
  },
};

export type EffectiveLlm = {
  /** 生效供应商（off 或未配置时为 null） */
  provider: LlmProviderName | null;
  /** 生效模型（已应用默认值） */
  model: string;
  /** 生效端点（custom 未配时为 null） */
  baseUrl: string | null;
  /** 已解析的生效 Key（服务端内部使用） */
  key: string | null;
  /** 界面显式关闭 LLM */
  off: boolean;
  /** 配置来源：db=界面设置 / env=环境变量 */
  source: "db" | "env";
};

/** 解析当前生效的 LLM 通道配置（界面配置 > 环境变量） */
export async function getEffectiveLlm(): Promise<EffectiveLlm> {
  // ---- 1) 环境变量基线（与旧版行为一致，含按 Key 前缀推断）----
  const envRaw = (
    process.env.UCRM_LLM_PROVIDER ||
    process.env.AI_PROVIDER ||
    ""
  ).toLowerCase();
  const envProvider = (envRaw === "qwen" ? "dashscope" : envRaw) as LlmProvider | "";
  const envKey =
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    "";
  const envBaseUrl = process.env.AI_BASE_URL || null;
  const envModel = process.env.AI_MODEL || null;

  // ---- 2) 界面配置（数据库，读缓存）----
  let db: LlmStoredConfig | null = null;
  try {
    const raw = await getAppConfigRaw(LLM_CONFIG_KEY);
    if (raw) db = JSON.parse(raw) as LlmStoredConfig;
  } catch {
    db = null; // 坏数据不阻断主流程，回落环境变量
  }

  // 未在界面配置 → 走环境变量（旧版行为完全兼容）
  if (!db || !db.provider) {
    if (envProvider === "off") {
      return { provider: null, model: "", baseUrl: null, key: null, off: true, source: "env" };
    }
    // 推断 provider：显式 > 按 Key 前缀猜测（旧版逻辑）
    let resolved: LlmProviderName;
    if (envProvider) resolved = envProvider;
    else if (process.env.DASHSCOPE_API_KEY && !process.env.OPENAI_API_KEY) resolved = "dashscope";
    else if (process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) resolved = "deepseek";
    else if ((process.env.OPENAI_API_KEY || "").startsWith("sk-")) resolved = "openai";
    else resolved = "custom";
    const defaults = PROVIDER_DEFAULTS[resolved];
    return {
      provider: resolved,
      model: envModel || defaults.model,
      baseUrl: envBaseUrl || defaults.baseUrl || null,
      key: envKey || null,
      off: false,
      source: "env",
    };
  }

  // 界面显式关闭 → 纯规则引擎
  if (db.provider === "off") {
    return { provider: null, model: "", baseUrl: null, key: null, off: true, source: "db" };
  }

  // ---- 3) 界面配置生效：provider/model/baseUrl/key 逐项解析 ----
  const provider = db.provider as LlmProviderName;
  const defaults = PROVIDER_DEFAULTS[provider];
  const dbKeys = db.keys ?? {};
  const specificKey =
    provider === "dashscope"
      ? dbKeys.dashscope
      : provider === "deepseek"
        ? dbKeys.deepseek
        : provider === "openai"
          ? dbKeys.openai
          : dbKeys.custom;
  const key = (specificKey || envKey || "").trim();
  const baseUrl =
    provider === "custom"
      ? (db.baseUrl || envBaseUrl || "").trim()
      : (envBaseUrl || defaults.baseUrl);
  const model = db.model || envModel || defaults.model;

  return {
    provider,
    model,
    baseUrl: baseUrl || null,
    key: key || null,
    off: false,
    source: "db",
  };
}
