import "server-only";

/**
 * 企业公开信息入口 [CRM·公开信息]
 * ----------------------------------------------------------------------------
 * 边界（必须遵守）：
 *   ✅ 只做「公开搜索入口跳转」与「官网公开页只读抓取」—— 等同于人手动打开网页
 *   ❌ 不绕过登录、验证码、付费墙；不模拟登录；不注入 Cookie；不购买/调用付费数据源
 *   ❌ 抓取结果只作展示，不自动写回客户主表（要落库必须人工确认）
 *
 * 抓取失败 / 被拦截时如实返回 blocked 原因，由 UI 明确提示，绝不静默造假数据。
 */

export type PublicSearchLink = { label: string; url: string };

/** 公开网页抓取结果 */
export type PublicSiteInfo = {
  ok: boolean;
  /** 规范化后的入口地址 */
  url: string;
  title?: string;
  description?: string;
  emails: string[];
  phones: string[];
  /** 被拦截的原因；ok=true 时为 undefined */
  blocked?: "INVALID_URL" | "FORBIDDEN" | "LOGIN_REQUIRED" | "CAPTCHA" | "PAYWALL" | "NOT_HTML" | "TIMEOUT" | "ERROR";
  note?: string;
  fetchedAt: string;
};

const FETCH_TIMEOUT_MS = 6000;

/** 官网地址规范化：补协议、去尾部斜杠；非法返回 null */
export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return null;
  }
}

/** 按企业名称 + 官网生成公开搜索入口（点击后在搜索引擎中人工查阅） */
export function buildPublicSearchLinks(
  name: string,
  website?: string | null,
): PublicSearchLink[] {
  const q = name.trim();
  if (!q) return [];
  const enc = encodeURIComponent(q);
  const links: PublicSearchLink[] = [
    { label: "百度搜索企业名称", url: `https://www.baidu.com/s?wd=${enc}` },
    { label: "必应搜索企业名称", url: `https://www.bing.com/search?q=${enc}` },
  ];
  const site = normalizeWebsite(website);
  if (site) {
    const host = (() => {
      try {
        return new URL(site).host;
      } catch {
        return site;
      }
    })();
    links.push({ label: `站内搜索（site:${host}）`, url: `https://www.bing.com/search?q=site%3A${encodeURIComponent(host)}` });
  } else {
    links.push({ label: "按企业名找官网", url: `https://www.bing.com/search?q=${enc}%20%E5%AE%98%E7%BD%91` });
  }
  return links;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** 识别「需要登录 / 验证码 / 付费」的公开页——识别到即停止，不做任何绕过 */
function detectBlock(html: string, status: number): PublicSiteInfo["blocked"] | undefined {
  if (status === 401 || status === 403) return "FORBIDDEN";
  const text = stripTags(html).toLowerCase();
  const raw = html.toLowerCase();
  if (/(验证码|captcha|recaptcha|hcaptcha|人机验证|请完成安全验证)/.test(text)) return "CAPTCHA";
  if (/(请登录|登录后查看|请先登录|会员可见|付费查看|开通会员|立即登录|sign in to continue|log in to view|login required)/.test(text))
    return "LOGIN_REQUIRED";
  if (/(付费内容|订阅后可看|充值后查看|paywall|subscribe to read)/.test(text)) return "PAYWALL";
  // 登录表单特征（用户名+密码输入框）
  if (/type=["']?password/i.test(raw) && /type=["']?(text|email)/i.test(raw)) return "LOGIN_REQUIRED";
  return undefined;
}

/**
 * 只读抓取官网公开首页，提取标题、描述与页面上的联系方式。
 * 不做登录 / 不破解验证码 / 不买付费数据；遇到拦截如实返回 blocked。
 */
export async function fetchPublicSiteInfo(rawUrl: string | null | undefined): Promise<PublicSiteInfo | null> {
  const url = normalizeWebsite(rawUrl);
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        // 标识为普通浏览器只读访问；不携带任何凭证
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "zh-CN,zh;q=0.9",
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        url,
        emails: [],
        phones: [],
        blocked: res.status === 401 || res.status === 403 ? "FORBIDDEN" : "ERROR",
        note: `公开页返回 HTTP ${res.status}，未读取内容（不做任何绕过）`,
        fetchedAt: new Date().toISOString(),
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return {
        ok: false,
        url,
        emails: [],
        phones: [],
        blocked: "NOT_HTML",
        note: `该地址返回 ${contentType || "非网页内容"}，仅支持公开网页`,
        fetchedAt: new Date().toISOString(),
      };
    }

    const html = await res.text();
    const blocked = detectBlock(html, res.status);
    if (blocked) {
      return {
        ok: false,
        url,
        emails: [],
        phones: [],
        blocked,
        note: "该页面需要登录、验证码或付费才能查看，已停止读取（不绕过）",
        fetchedAt: new Date().toISOString(),
      };
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);

    // 联系方式只取页面里公开可见的 mailto / tel 与正文中的邮箱、电话
    const emails = new Set<string>();
    const phones = new Set<string>();
    for (const m of html.matchAll(/mailto:([^"'\s>?]+)/gi)) {
      const v = decodeURIComponent(m[1]!).trim();
      if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) emails.add(v.toLowerCase());
    }
    for (const m of html.matchAll(/tel:([^"'\s>]+)/gi)) {
      const v = decodeURIComponent(m[1]!).trim();
      if (/^[\d+\-() ]{6,20}$/.test(v)) phones.add(v);
    }
    const text = stripTags(html);
    for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) emails.add(m[0].toLowerCase());
    for (const m of text.matchAll(/(?:\+?86[\s-]?)?1[3-9]\d{9}/g)) phones.add(m[0].replace(/\s|-/g, ""));

    return {
      ok: true,
      url,
      title: titleMatch ? decodeEntities(stripTags(titleMatch[1]!)).slice(0, 200) || undefined : undefined,
      description: descMatch ? decodeEntities(descMatch[1]!).slice(0, 400) || undefined : undefined,
      emails: [...emails].slice(0, 5),
      phones: [...phones].slice(0, 5),
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      url,
      emails: [],
      phones: [],
      blocked: aborted ? "TIMEOUT" : "ERROR",
      note: aborted
        ? `读取超时（${FETCH_TIMEOUT_MS / 1000}s），请直接访问官网确认`
        : `读取失败：${e instanceof Error ? e.message : String(e)}`,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export const BLOCKED_LABEL: Record<NonNullable<PublicSiteInfo["blocked"]>, string> = {
  INVALID_URL: "地址无效",
  FORBIDDEN: "站点拒绝访问（401/403）",
  LOGIN_REQUIRED: "需登录后可查看",
  CAPTCHA: "存在人机验证",
  PAYWALL: "付费内容",
  NOT_HTML: "非网页内容",
  TIMEOUT: "读取超时",
  ERROR: "读取失败",
};
