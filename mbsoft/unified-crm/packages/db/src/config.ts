import { prisma } from "./index";

/**
 * 全局运行时配置（AppConfig 表）读写 [CONFIG]
 *
 * 用途：把「需运维编辑、但不想改 .env / 重启容器」的配置（当前主要是 LLM 通道）
 * 下沉到数据库，由管理界面读写，保存即生效。
 *
 * 设计要点：
 *   - 读走 30s 进程内缓存：AI 每次调用都会解析生效配置，避免每次都打库；
 *     界面保存后会显式 clearAppConfigCache，立即生效。
 *   - value 存 JSON 字符串，按 key 定义各自的 schema（见 LlmStoredConfig）。
 *   - API Key 明文存库（自托管部署可接受），任何下发客户端的视图必须脱敏。
 */

const CACHE = new Map<string, { value: string | null; ts: number }>();
const TTL_MS = 30_000;

/** 读取配置原始 JSON（不存在返回 null；30s 进程内缓存） */
export async function getAppConfigRaw(key: string): Promise<string | null> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.value;
  const row = await prisma.appConfig.findUnique({ where: { key } });
  const value = row?.value ?? null;
  CACHE.set(key, { value, ts: Date.now() });
  return value;
}

/** 写入配置（upsert）并刷新缓存 */
export async function setAppConfigRaw(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  CACHE.set(key, { value, ts: Date.now() });
}

/** 删除配置（不存在时静默）并刷新缓存 */
export async function deleteAppConfig(key: string): Promise<void> {
  await prisma.appConfig.deleteMany({ where: { key } });
  CACHE.delete(key);
}

/** 清除缓存（保存/重置后调用，使新配置立即生效）；不传 key 则全清 */
export function clearAppConfigCache(key?: string): void {
  if (key) CACHE.delete(key);
  else CACHE.clear();
}

// ============================================================================
// LLM 通道配置（key = "llm"）
// ============================================================================

export const LLM_CONFIG_KEY = "llm";

export type LlmProvider = "openai" | "dashscope" | "deepseek" | "custom" | "off";

export type LlmStoredConfig = {
  /** "" = 未在界面配置（走环境变量默认）；"off" = 显式关闭（纯规则引擎） */
  provider: LlmProvider | "";
  /** 覆盖默认模型（如 qwen-max / deepseek-reasoner） */
  model?: string;
  /** 仅 provider=custom 必填：OpenAI 兼容端点 Base URL */
  baseUrl?: string;
  /** 各供应商专属 Key；空 = 未保存（保留旧值 / 回落环境变量） */
  keys: {
    dashscope?: string;
    deepseek?: string;
    openai?: string;
    custom?: string;
  };
};
