import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/store";
import { adminGuard, DEFAULT_LLM_CONFIG, DEFAULT_SITE_SETTINGS, readLlmConfig, readSiteSettings, PROVIDER_PRESETS } from "@/lib/admin";
import { LlmConfig, SiteSettings } from "@/lib/types";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 保存后台配置（大模型 / 站点运营）
export async function PUT(req: NextRequest) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  const body = await req.json();
  const done: string[] = [];

  if (body.llm) {
    const cur = readLlmConfig();
    // 注意顺序：默认值在最底层，已存值覆盖默认值，本次提交覆盖已存值
    // （写成 {...cur, ...DEFAULT, ...body} 会让未提交字段被重置为默认值）
    const next: LlmConfig = { ...DEFAULT_LLM_CONFIG, ...cur, ...body.llm };

    const provider = String(next.provider);
    if (!PROVIDER_PRESETS[provider]) {
      return NextResponse.json({ error: "未知的大模型供应商" }, { status: 400 });
    }
    const baseUrl = String(next.baseUrl ?? "").trim().replace(/\/+$/, "");
    const model = String(next.model ?? "").trim();
    const temperature = Number(next.temperature);
    const maxTokens = Number(next.maxTokens);

    if (next.enabled) {
      if (!baseUrl) return NextResponse.json({ error: "启用前请填写 Base URL" }, { status: 400 });
      if (!/^https?:\/\//.test(baseUrl)) return NextResponse.json({ error: "Base URL 需以 http(s):// 开头" }, { status: 400 });
      if (!model) return NextResponse.json({ error: "启用前请填写模型名称" }, { status: 400 });
      if (!String(next.apiKey ?? "").trim()) return NextResponse.json({ error: "启用前请填写 API Key" }, { status: 400 });
    }
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      return NextResponse.json({ error: "温度需在 0 ~ 2 之间" }, { status: 400 });
    }
    if (!Number.isFinite(maxTokens) || maxTokens < 1 || maxTokens > 32768) {
      return NextResponse.json({ error: "最大输出长度需在 1 ~ 32768 之间" }, { status: 400 });
    }

    db.setSetting("llm_config", {
      ...next,
      baseUrl,
      model,
      temperature,
      maxTokens: Math.round(maxTokens),
      systemPrompt: String(next.systemPrompt ?? "").slice(0, 2000),
      updatedAt: new Date().toISOString(),
      updatedBy: g.user.email,
    });
    done.push("大模型配置");
  }

  if (body.site) {
    const cur = readSiteSettings();
    // 同上：默认值在最底层，避免局部提交把其他字段重置为默认值
    const next: SiteSettings = { ...DEFAULT_SITE_SETTINGS, ...cur, ...body.site };
    const num = (v: unknown, min: number, max: number, label: string) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label}需在 ${min} ~ ${max} 之间`);
      return Math.round(n);
    };
    try {
      db.setSetting("site_settings", {
        siteName: String(next.siteName ?? "").trim() || DEFAULT_SITE_SETTINGS.siteName,
        announcement: String(next.announcement ?? "").slice(0, 200),
        registerBonus: num(next.registerBonus, 0, 10000, "注册赠送积分"),
        checkInPoints: num(next.checkInPoints, 0, 1000, "每日打卡积分"),
        postPoints: num(next.postPoints, 0, 1000, "发帖奖励积分"),
        inviteRewardInviter: num(next.inviteRewardInviter, 0, 10000, "邀请人奖励积分"),
        inviteRewardInvitee: num(next.inviteRewardInvitee, 0, 10000, "被邀请人奖励积分"),
      });
      done.push("站点设置");
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  if (done.length === 0) {
    return NextResponse.json({ error: "没有需要保存的内容" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: `已保存${done.join("、")}` });
}
