import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readLlmConfig } from "@/lib/admin";
import { db } from "@/lib/store";
import { runAgent } from "@/lib/agent";
import { getChatAccess, AI_FREE_TRIALS } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET：返回 agent 是否可用（大模型已启用且已配 key），供前端决定是否展示入口
export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const cfg = readLlmConfig();
  const { searchParams } = new URL(req.url);
  const cid = searchParams.get("conversationId");

  if (cid) {
    const messages = db
      .getMessages(cid, user.id)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    return NextResponse.json({ conversationId: cid, messages });
  }

  const conversations = db
    .listConversations(user.id)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }));
  // chat：当前用户的 AI 助手额度（年度会员不限次，其他用户 1 次免费体验）
  return NextResponse.json({
    enabled: cfg.enabled && !!cfg.apiKey,
    conversations,
    chat: getChatAccess(user),
  });
}

// POST：接收一条用户消息，SSE 流式返回 token / 工具事件，并持久化会话
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体错误" }, { status: 400 });
  }

  const message = String(body?.message || "").trim();
  if (!message) return NextResponse.json({ error: "消息不能为空" }, { status: 400 });

  // 额度门禁：年度会员不限次；其他用户仅 1 次免费体验，用完须先购买会员。
  // 这里用 402（而非 403）便于前端区分「需要付费」与「无权限」。
  const chat = getChatAccess(user);
  if (!chat.allowed) {
    return NextResponse.json(
      {
        error: "AI 助手免费体验次数已用完，开通年度会员可不限次使用",
        code: "chat_quota_exhausted",
        chat,
      },
      { status: 402 }
    );
  }

  const conversationId =
    String(body?.conversationId || "").trim() || "conv-" + Math.random().toString(36).slice(2, 10);

  // 确保会话归属当前用户
  if (!db.getConversation(conversationId, user.id)) {
    db.createConversation({ id: conversationId, userId: user.id, title: message.slice(0, 30) });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      // 计费时机：模型真正产出内容（首个 token 或首次工具调用）后才 +1。
      // 请求失败 / 空回复不计数，避免网络或服务抖动白白吞掉用户仅有的 1 次免费额度。
      let counted = false;
      const charge = () => {
        if (counted) return;
        counted = true;
        try {
          chat.used = db.bumpAiUsage(user.id);
          if (!chat.unlimited) chat.remaining = Math.max(0, AI_FREE_TRIALS - chat.used);
          send({ type: "quota", used: chat.used, remaining: chat.remaining, unlimited: chat.unlimited });
        } catch {
          /* 计数失败不影响对话本身 */
        }
      };
      try {
        send({ type: "meta", conversationId });
        for await (const ev of runAgent({ user, conversationId, message, toolsEnabled: true })) {
          if (ev.type === "token" || ev.type === "tool") charge();
          send(ev);
        }
      } catch (e: any) {
        send({ type: "error", message: e?.message || "对话失败" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
