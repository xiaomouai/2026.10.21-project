"use server";

import { revalidatePath } from "next/cache";
import {
  prisma,
  getAppConfigRaw,
  setAppConfigRaw,
  deleteAppConfig,
  clearAppConfigCache,
  LLM_CONFIG_KEY,
  type LlmProvider,
  type LlmStoredConfig,
} from "@ucrm/db";
import { requireUser } from "../session";
import { getEffectiveLlm } from "../ai/llm-config";

/**
 * LLM 通道配置 Server Actions [CONFIG]
 *
 * 把供应商 / Key / 模型 / 端点存入数据库（AppConfig.llm），
 * 保存即生效 —— 无需改 .env、无需重启容器。
 *
 * 权限：仅组织 OWNER / ADMIN 可修改（读视图要求登录即可）。
 * 安全：Key 明文存库（自托管部署可接受）；任何返回客户端的视图一律脱敏（仅尾 4 位），
 *       客户端提交空 Key 表示「保留已保存值」，不回传明文。
 */

export type LlmConfigView = {
  /** 界面已保存的配置（从未配置过为 null，走环境变量） */
  stored: {
    provider: LlmProvider | "";
    model: string;
    baseUrl: string;
  } | null;
  /** 当前生效（合并 env 后的最终结果） */
  effective: {
    provider: LlmProvider | "off" | "";
    model: string;
    baseUrl: string | null;
    available: boolean;
    off: boolean;
    source: "db" | "env";
  };
  /** 已保存 Key 的脱敏尾号（未保存为 ""） */
  masked: { dashscope: string; deepseek: string; openai: string; custom: string };
};

export type SaveLlmInput = {
  provider: LlmProvider | "off" | "";
  model: string;
  baseUrl: string;
  /** 新 Key（空串 = 保留已保存值不覆盖） */
  keys: { dashscope: string; deepseek: string; openai: string; custom: string };
};

export type LlmConfigActionState = {
  ok: boolean;
  error?: string;
  view?: LlmConfigView;
};

/** 脱敏：只保留尾 4 位 */
function maskKey(key: string | undefined): string {
  if (!key) return "";
  return `••••${key.slice(-4)}`;
}

async function readStored(): Promise<LlmStoredConfig | null> {
  const raw = await getAppConfigRaw(LLM_CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LlmStoredConfig;
  } catch {
    return null;
  }
}

/** 读取配置视图（登录即可）：已存配置（脱敏）+ 当前生效状态 */
export async function getLlmConfigView(): Promise<LlmConfigView> {
  await requireUser();
  const stored = await readStored();
  const eff = await getEffectiveLlm();
  return {
    stored: stored
      ? {
          provider: stored.provider || "",
          model: stored.model || "",
          baseUrl: stored.baseUrl || "",
        }
      : null,
    effective: {
      provider: eff.off ? "off" : (eff.provider ?? ""),
      model: eff.model,
      baseUrl: eff.baseUrl,
      available: !!(eff.provider && eff.key && eff.baseUrl),
      off: eff.off,
      source: eff.source,
    },
    masked: {
      dashscope: maskKey(stored?.keys?.dashscope),
      deepseek: maskKey(stored?.keys?.deepseek),
      openai: maskKey(stored?.keys?.openai),
      custom: maskKey(stored?.keys?.custom),
    },
  };
}

/** 校验当前用户在 slug 组织内是否 OWNER/ADMIN */
async function requireOrgAdmin(slug: string): Promise<boolean> {
  const user = await requireUser();
  const org = await prisma.organization.findFirst({
    where: {
      slug,
      members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } },
    },
  });
  return !!org;
}

/** 保存界面配置（仅 OWNER/ADMIN）。空 Key = 保留旧值。 */
export async function saveLlmConfig(
  input: SaveLlmInput,
  slug: string,
): Promise<LlmConfigActionState> {
  if (!(await requireOrgAdmin(slug))) {
    return { ok: false, error: "仅组织所有者/管理员可修改模型配置" };
  }

  const provider = input.provider;
  if (provider !== "" && !["openai", "dashscope", "deepseek", "custom", "off"].includes(provider)) {
    return { ok: false, error: `不支持的供应商：${provider}` };
  }

  // custom 必须有合法 Base URL
  if (provider === "custom") {
    const url = input.baseUrl.trim();
    if (!url) return { ok: false, error: "自定义端点必须填写 Base URL" };
    try {
      new URL(url);
    } catch {
      return { ok: false, error: "Base URL 不是合法地址（需含 http(s)://）" };
    }
  }

  // 合并旧值（空 Key 不覆盖）
  const prev = await readStored();
  const next: LlmStoredConfig = {
    provider,
    model: input.model.trim() || undefined,
    baseUrl: input.baseUrl.trim() || undefined,
    keys: {
      dashscope: input.keys.dashscope.trim() || prev?.keys?.dashscope || undefined,
      deepseek: input.keys.deepseek.trim() || prev?.keys?.deepseek || undefined,
      openai: input.keys.openai.trim() || prev?.keys?.openai || undefined,
      custom: input.keys.custom.trim() || prev?.keys?.custom || undefined,
    },
  };

  // 选了具体供应商但既无界面 Key 也无环境变量兜底 → 拒绝保存
  if (provider && provider !== "off") {
    const hasKey =
      (provider === "dashscope" && next.keys.dashscope) ||
      (provider === "deepseek" && next.keys.deepseek) ||
      (provider === "openai" && next.keys.openai) ||
      (provider === "custom" && next.keys.custom);
    const envKey =
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.DASHSCOPE_API_KEY ||
      process.env.DEEPSEEK_API_KEY;
    if (!hasKey && !envKey) {
      return { ok: false, error: "请填写该供应商的 API Key（未配置 Key 将无法调用模型）" };
    }
  }

  await setAppConfigRaw(LLM_CONFIG_KEY, JSON.stringify(next));
  clearAppConfigCache(LLM_CONFIG_KEY);
  revalidatePath(`/w/${slug}/settings/ai`);

  return { ok: true, view: await getLlmConfigView() };
}

/** 清除界面配置，回到环境变量默认（仅 OWNER/ADMIN） */
export async function resetLlmConfig(slug: string): Promise<LlmConfigActionState> {
  if (!(await requireOrgAdmin(slug))) {
    return { ok: false, error: "仅组织所有者/管理员可修改模型配置" };
  }
  await deleteAppConfig(LLM_CONFIG_KEY);
  clearAppConfigCache(LLM_CONFIG_KEY);
  revalidatePath(`/w/${slug}/settings/ai`);
  return { ok: true, view: await getLlmConfigView() };
}
