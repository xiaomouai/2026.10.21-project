import { NextRequest, NextResponse } from "next/server";
import { adminGuard, readLlmConfig } from "@/lib/admin";

export const maxDuration = 30;

// 测试大模型连通性：用当前（或表单里刚填的）配置发一次最小请求
export async function POST(req: NextRequest) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const body = await req.json().catch(() => ({}));
  const cfg = { ...readLlmConfig(), ...(body.llm ?? {}) };

  const baseUrl = String(cfg.baseUrl ?? "").trim().replace(/\/+$/, "");
  const apiKey = String(cfg.apiKey ?? "").trim();
  const model = String(cfg.model ?? "").trim();

  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
    return NextResponse.json({ ok: false, error: "请先填写合法的 Base URL（以 http(s):// 开头）" }, { status: 400 });
  }
  if (!apiKey) return NextResponse.json({ ok: false, error: "请先填写 API Key" }, { status: 400 });
  if (!model) return NextResponse.json({ ok: false, error: "请先填写模型名称" }, { status: 400 });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是连通性测试助手，只回复简短内容。" },
          { role: "user", content: "请只回复四个字：连接正常" },
        ],
        max_tokens: 32,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    const cost = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        detail = j.error?.message || j.message || detail;
      } catch {
        /* 保留原始文本 */
      }
      return NextResponse.json(
        { ok: false, error: `调用失败（HTTP ${res.status}）：${detail}`, cost },
        { status: 200 }
      );
    }

    let reply = "";
    let usage: unknown = null;
    try {
      const j = JSON.parse(text);
      reply = j.choices?.[0]?.message?.content ?? "";
      usage = j.usage ?? null;
    } catch {
      reply = text.slice(0, 200);
    }

    return NextResponse.json({
      ok: true,
      message: "连接成功",
      cost,
      model,
      reply: reply.trim().slice(0, 200),
      usage,
    });
  } catch (e: any) {
    const cost = Date.now() - started;
    const aborted = e?.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        error: aborted
          ? "请求超时（20 秒），请检查 Base URL 与网络连通性"
          : `请求异常：${e?.message || e}`,
        cost,
      },
      { status: 200 }
    );
  } finally {
    clearTimeout(timer);
  }
}
