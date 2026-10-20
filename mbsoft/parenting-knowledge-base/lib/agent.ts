import { db } from "./store";
import { PublicUser } from "./types";
import { readLlmConfig } from "./admin";
import { buildSystemPrompt, retrieve } from "./agent-memory";
import { TOOLS, executeTool } from "./agent-tools";
import { streamChat } from "./llm";

const MAX_STEPS = 6;

function rid(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 10);
}

/**
 * 运行一次对话（ReAct loop），通过 AsyncGenerator 逐事件吐出：
 *   { type: "meta", conversationId }
 *   { type: "token", text }        // 流式文本片段
 *   { type: "tool", name, result } // 工具调用结果（前端可提示）
 *   { type: "error", message }
 *   { type: "done" }
 * 事件由路由层封装为 SSE 推给前端。无 LLM key 时自动降级为「检索式规则回复」。
 */
export async function* runAgent(opts: {
  user: PublicUser;
  conversationId: string;
  message: string;
  toolsEnabled: boolean;
}): AsyncGenerator<any> {
  const { user, conversationId, message, toolsEnabled } = opts;
  const cfg = readLlmConfig();

  // 持久化用户消息 + 刷新会话时间
  db.addMessage({ id: rid("m-"), conversationId, role: "user", content: message });
  db.touchConversation(conversationId, message.slice(0, 30));

  const systemText = buildSystemPrompt(user);
  const kb = retrieve(user, message, 3);
  const systemContent =
    kb ? `${systemText}\n\n【参考资料（仅作依据，可引用并给出链接）】\n${kb}` : systemText;

  // 历史（去掉刚写入的当前条与 system）
  const raw = db.getMessages(conversationId, user.id).filter((m) => m.role !== "system");
  const prior = raw.slice(0, -1).map((m) => ({ role: m.role as any, content: m.content }));

  const messages: any[] = [
    { role: "system", content: systemContent },
    ...prior,
    { role: "user", content: message },
  ];

  // ---------- 无 LLM：检索式规则降级 ----------
  if (!cfg.enabled || !cfg.apiKey) {
    const text = kb
      ? `（AI 助手暂未配置大模型，以下为知识库相关资料）\n\n${kb}\n\n如需进一步帮助，可在「论坛」发帖求助。`
      : "AI 助手暂未配置大模型，无法回答。你可以在「论坛」发帖，或补全宝宝档案获取更精准建议。";
    db.addMessage({ id: rid("m-"), conversationId, role: "assistant", content: text });
    yield { type: "token", text };
    yield { type: "done" };
    return;
  }

  const useTools = toolsEnabled;
  let finalContent = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    let content = "";
    const toolCalls: any[] = [];

    for await (const d of streamChat({ messages, tools: useTools ? TOOLS : undefined })) {
      if (d.content) {
        content += d.content;
        yield { type: "token", text: d.content };
      }
      if (d.tool_calls) {
        for (const tc of d.tool_calls) {
          const i = tc.index ?? 0;
          toolCalls[i] = toolCalls[i] || { id: "", type: "function", function: { name: "", arguments: "" } };
          if (tc.id) toolCalls[i].id = tc.id;
          if (tc.function?.name) toolCalls[i].function.name += tc.function.name;
          if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments;
        }
      }
    }

    // 模型要求调用工具：执行并把结果回灌，再让模型生成最终回答
    if (toolCalls.length && toolCalls.some((t) => t.function.name)) {
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: "function",
          function: { name: t.function.name, arguments: t.function.arguments },
        })),
      });
      for (const t of toolCalls) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(t.function.arguments || "{}");
        } catch {
          /* 参数不完整时以空对象传给工具 */
        }
        const result = await executeTool(t.function.name, parsed, user);
        messages.push({ role: "tool", tool_call_id: t.id, content: result });
        yield { type: "tool", name: t.function.name, result };
      }
      continue;
    }

    finalContent = content;
    break;
  }

  if (!finalContent) {
    finalContent = "（未能生成回答，请稍后再试）";
    yield { type: "token", text: finalContent };
  }
  db.addMessage({ id: rid("m-"), conversationId, role: "assistant", content: finalContent });
  yield { type: "done" };
}
