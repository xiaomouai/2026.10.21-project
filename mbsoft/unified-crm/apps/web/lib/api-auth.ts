import { prisma } from "@ucrm/db";

/**
 * REST 接口统一鉴权 [AI·NEW · P3-1]
 * --------------------------------------------------------------------------
 * 双模式，向后兼容：
 *   1) 生产模式（配置了 UCRM_API_KEYS）：强制 Bearer API Key。
 *      Key 映射格式：UCRM_API_KEYS="slug1=key1,slug2=key2"
 *      请求头：Authorization: Bearer <key>  → 命中后解析出对应组织 slug。
 *   2) 开发模式（未配置 UCRM_API_KEYS）：回退 X-Org-Slug 头，再回退请求体/查询的
 *      orgSlug（与历史行为一致），可选附带 X-User-Email 用于确定操作人。
 *
 * 安全要点：
 *   - 生产模式下无有效 Key 一律 401，绝不回退到 slug 头（防越权）。
 *   - 一切结果带 orgId，调用方必须用 orgId 过滤，杜绝跨租户。
 */

export type ApiAuthResult =
  | { ok: true; orgId: string; orgSlug: string; mode: "apikey" | "dev" }
  | { ok: false; status: number; error: string };

/** 解析 UCRM_API_KEYS="slug1=key1,slug2=key2" → { key: slug } */
function loadKeyMap(): Record<string, string> {
  const raw = process.env.UCRM_API_KEYS;
  if (!raw) return {};
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const slug = pair.slice(0, eq).trim();
    const key = pair.slice(eq + 1).trim();
    if (slug && key) map[key] = slug;
  }
  return map;
}

export async function resolveApiOrg(req: Request, fallbackSlug?: string): Promise<ApiAuthResult> {
  const keyMap = loadKeyMap();
  const auth = req.headers.get("authorization");
  const bearer = auth && auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (Object.keys(keyMap).length > 0) {
    // —— 生产模式：强制 API Key ——
    if (!bearer || !keyMap[bearer]) {
      return { ok: false, status: 401, error: "缺少或无效的 API Key（生产环境需 Authorization: Bearer <key>）" };
    }
    const slug = keyMap[bearer];
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) return { ok: false, status: 404, error: "org not found" };
    return { ok: true, orgId: org.id, orgSlug: org.slug, mode: "apikey" };
  }

  // —— 开发模式：X-Org-Slug → 请求体/查询回退 ——
  const slug = req.headers.get("x-org-slug") ?? fallbackSlug;
  if (!slug) return { ok: false, status: 400, error: "缺少组织标识：生产用 Bearer Key，开发用 X-Org-Slug 或请求体 orgSlug" };
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) return { ok: false, status: 404, error: "org not found" };
  return { ok: true, orgId: org.id, orgSlug: org.slug, mode: "dev" };
}

/** 从请求头解析操作人邮箱（开发模式下用于确定 createdById） */
export function resolveEmail(req: Request): string | undefined {
  const e = req.headers.get("x-user-email");
  return e && e.includes("@") ? e : undefined;
}
