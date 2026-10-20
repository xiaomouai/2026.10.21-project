import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { db } from "./store";
import { PublicUser, LlmConfig, SiteSettings } from "./types";

// ---------- 管理员鉴权 ----------
// 复用前台会话 cookie，通过 role 字段区分管理员
export function getAdminUser(): PublicUser | null {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// 注意：本项目 tsconfig 为 strict:false，布尔字面量判别式无法被收窄，
// 因此用字符串字面量 kind 作为判别字段。
type Guard = { kind: "ok"; user: PublicUser } | { kind: "err"; res: NextResponse };

// API 路由统一守卫：const g = adminGuard(); if (g.kind === "err") return g.res;
export function adminGuard(): Guard {
  const user = getCurrentUser();
  if (!user) {
    return { kind: "err", res: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { kind: "err", res: NextResponse.json({ error: "无管理员权限" }, { status: 403 }) };
  }
  return { kind: "ok", user };
}

// ---------- 后台配置默认值 ----------
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  provider: "dashscope",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "",
  model: "qwen-plus",
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: "你是一位好宝宝育儿知识库的 AI 助手，回答需基于婴幼儿睡眠与喂养的好宝宝依据，不替代医生诊断。",
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "好宝宝育儿知识库",
  announcement: "",
  registerBonus: 50,
  checkInPoints: 10,
  postPoints: 5,
  inviteRewardInviter: 100,
  inviteRewardInvitee: 30,
};

// 供应商预设（选供应商自动带出 baseUrl 与常用模型）
export const PROVIDER_PRESETS: Record<
  string,
  { label: string; baseUrl: string; models: string[] }
> = {
  dashscope: {
    label: "阿里云百炼 / 通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long"],
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  moonshot: {
    label: "Moonshot 月之暗面",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k"],
  },
  custom: {
    label: "自定义（OpenAI 兼容）",
    baseUrl: "",
    models: [],
  },
};

// 取第一个非空的环境变量（trim 后）
function envStr(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

// 读取大模型配置。
// 优先级：**settings 表（后台手填）> 环境变量 > 内置默认值**。
// 环境变量用于 Docker/服务器部署时注入密钥，免去全新部署后还要进后台手填一次：
//   LLM_API_KEY / DASHSCOPE_API_KEY、LLM_BASE_URL、LLM_MODEL、LLM_ENABLED
// 注意：后台若显式把开关关掉（llm_config.enabled === false），环境变量不会强行开启。
export function readLlmConfig(): LlmConfig {
  const stored = db.getSetting<Partial<LlmConfig>>("llm_config", {}) || {};
  const base = { ...DEFAULT_LLM_CONFIG, ...stored };

  const envKey = envStr("LLM_API_KEY", "DASHSCOPE_API_KEY");
  const envBaseUrl = envStr("LLM_BASE_URL");
  const envModel = envStr("LLM_MODEL");
  const envEnabled = envStr("LLM_ENABLED").toLowerCase();
  const explicitlyDisabled = "enabled" in stored && stored.enabled === false;

  return {
    ...base,
    apiKey: base.apiKey || envKey,
    baseUrl: base.baseUrl || envBaseUrl,
    model: base.model || envModel,
    provider: base.provider || (envBaseUrl ? "custom" : base.provider),
    enabled: explicitlyDisabled
      ? false
      : base.enabled || envEnabled === "1" || envEnabled === "true",
  };
}

export function readSiteSettings(): SiteSettings {
  return { ...DEFAULT_SITE_SETTINGS, ...db.getSetting<Partial<SiteSettings>>("site_settings", {}) };
}
