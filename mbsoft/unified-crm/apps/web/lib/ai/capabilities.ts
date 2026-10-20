import { getEffectiveLlm, PROVIDER_DEFAULTS } from "./llm-config";

/**
 * AI 能力探测与声明式降级 [AI·NEW]
 *
 * 借鉴 crm/ (Comp AI) `lib/capabilities.ts` 的思路：无 API Key 时系统依然可用，
 * 只是把「LLM 推断」降级为「本地规则推断」，并在 UI 明确标注。
 * 这样演示与交付不依赖外部环境。
 *
 * [CONFIG] 配置来源两级：
 *   1. 界面配置（设置 → AI 能力，存数据库 AppConfig.llm，保存即生效）
 *   2. 环境变量（UCRM_LLM_PROVIDER / DASHSCOPE_API_KEY / DEEPSEEK_API_KEY /
 *      OPENAI_API_KEY / AI_API_KEY / AI_BASE_URL / AI_MODEL，重启生效）
 * 解析逻辑见 lib/ai/llm-config.ts 的 getEffectiveLlm()。
 */

export type AiProvider = "openai" | "dashscope" | "deepseek" | "custom" | null;

export type AiCapabilities = {
  /** 是否存在可用的 LLM 通道 */
  available: boolean;
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
  /** true = 无 Key 或显式关闭，走规则引擎 */
  degraded: boolean;
  /** 给 UI 的一句话说明 */
  note: string;
};

/** 从「界面配置 + 环境变量」解析出当前 AI 能力（服务端调用，async） */
export async function detectAiCapabilities(): Promise<AiCapabilities> {
  const eff = await getEffectiveLlm();

  if (eff.off) {
    return {
      available: false,
      provider: null,
      model: "rules-engine",
      baseUrl: null,
      degraded: true,
      note: "LLM 已通过界面配置显式关闭，使用本地规则引擎推断（置信度偏低，仍需人工确认）",
    };
  }

  if (!eff.provider || !eff.key || !eff.baseUrl) {
    return {
      available: false,
      provider: null,
      model: "rules-engine",
      baseUrl: null,
      degraded: true,
      note: "降级模式：未配置模型 Key，使用本地规则引擎推断（置信度偏低，仍需人工确认）",
    };
  }

  const defaults = PROVIDER_DEFAULTS[eff.provider];
  return {
    available: true,
    provider: eff.provider,
    model: eff.model || defaults.model,
    baseUrl: eff.baseUrl,
    degraded: false,
    note: `LLM 模式：${defaults.label} · ${eff.model || defaults.model}`,
  };
}
