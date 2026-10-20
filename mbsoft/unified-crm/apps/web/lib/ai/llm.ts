/**
 * 统一 LLM 客户端（OpenAI 兼容 Chat Completions）
 *
 * 这是所有 AI 动作的**唯一**模型调用入口。解决的问题：
 *  - 旧代码中 ask-crm / lead-enrich / draft 各自 fetch，且 key 用
 *    `AI_API_KEY || OPENAI || DASHSCOPE || DEEPSEEK` 直接 `||` 拼接，
 *    导致 provider=deepseek 却把 AI_API_KEY 发到 DeepSeek 端点（必然 401）。
 *  - 现在「按当前生效 provider 严格取对应 key」，端点 / 模型 / key 三者一致。
 *
 * 支持的后端（配置来源见 lib/ai/llm-config.ts）：
 *  - 通义千问 Qwen：DashScope 兼容模式（provider=dashscope + DASHSCOPE_API_KEY）
 *  - DeepSeek：provider=deepseek + DEEPSEEK_API_KEY
 *  - OpenAI：provider=openai + OPENAI_API_KEY
 *  - 自定义 OpenAI 兼容端点：provider=custom + baseUrl + AI_API_KEY
 *  以上均可通过「设置 → AI 能力」界面配置（存数据库，保存即生效），
 *  或用环境变量（UCRM_LLM_PROVIDER 等，重启生效）。
 *
 * 任何失败都返回 null —— 调用方据此降级到规则 / 模板引擎，绝不抛错中断主流程。
 */

import { getEffectiveLlm } from "./llm-config";

export type LlmChatOpts = {
  /** system 指令 */
  system: string;
  /** user 内容 */
  user: string;
  /** 温度，默认 0.2 */
  temperature?: number;
  /** 请求结构化 JSON 输出（response_format: json_object），用于建档等需要解析的场景 */
  json?: boolean;
  /** 超时毫秒，默认 12s */
  timeoutMs?: number;
};

export type LlmUsage = {
  promptTokens?: number;
  completionTokens?: number;
};

export type LlmResult = {
  content: string;
  provider: string;
  model: string;
  usage?: LlmUsage;
};

/** 统一的 LLM 调用入口。失败时返回 null（调用方降级）。 */
export async function llmChat(opts: LlmChatOpts): Promise<LlmResult | null> {
  const eff = await getEffectiveLlm();
  if (!eff.provider || !eff.key || !eff.baseUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(`${eff.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${eff.key}`,
      },
      body: JSON.stringify({
        model: eff.model,
        temperature: opts.temperature ?? 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = j.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const usage: LlmUsage | undefined =
      j.usage?.prompt_tokens != null || j.usage?.completion_tokens != null
        ? {
            promptTokens: j.usage?.prompt_tokens ?? 0,
            completionTokens: j.usage?.completion_tokens ?? 0,
          }
        : undefined;
    return { content, provider: eff.provider, model: eff.model, usage };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
