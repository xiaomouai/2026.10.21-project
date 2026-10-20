import { readLlmConfig } from "./admin";

// OpenAI 兼容的对话补全流式客户端（不引第三方 SDK，用 fetch 直连 baseUrl）。
// 复用后台「大模型配置」中的 provider / baseUrl / apiKey / model。

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

/**
 * 流式调用 chat/completions，逐块 yield 上游 delta（含 content 与 tool_calls）。
 * 调用方负责把 tool_calls 的多个 delta 按 index 累积成完整调用。
 */
export async function* streamChat(opts: { messages: ChatMessage[]; tools?: any[] }) {
  const cfg = readLlmConfig();
  if (!cfg.enabled || !cfg.apiKey) return;

  const body: any = {
    model: cfg.model,
    messages: opts.messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    stream: true,
  };
  if (opts.tools && opts.tools.length) body.tools = opts.tools;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`大模型请求失败 (${res.status})${text ? " " + text.slice(0, 200) : ""}`);
  }

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
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data);
        const d = j.choices?.[0]?.delta;
        if (d) yield d;
      } catch {
        /* 跳过不完整/非 JSON 行 */
      }
    }
  }
}
