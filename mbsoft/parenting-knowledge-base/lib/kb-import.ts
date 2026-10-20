// 知识库 Markdown 导入 / 导出（无额外依赖）
//
// 支持两种文件格式：
// ① 单篇 .md：带 YAML frontmatter（title/category/slug/isPremium/excerpt）+ 正文；
//    无 frontmatter 时回退为「首个 # 标题」作为标题、分类取导入时的默认分类。
// ② 整库 bundle .md：多个文档用分隔符 KB_DOC_SEP 拼接，便于「导出→本地编辑→再导入」闭环。
//
// 导入模式 mode：
//   create  —— 仅新增：slug 已存在则跳过
//   upsert  —— 按 slug 覆盖更新已存在的，不存在则新增（推荐用于「批量维护」）
//   replace —— 先清空全部教程再全量导入（危险，需 UI 二次确认）

import { db } from "./store";

export const KB_DOC_SEP = "✂️===KB_DOC===✂️";

export type TopicDraft = {
  title: string;
  category: string;
  slug: string;
  excerpt: string;
  content: string;
  isPremium: boolean;
};

export type ParseResult =
  | { ok: true; draft: TopicDraft }
  | { ok: false; error: string };

export type ImportReport = {
  created: number;
  updated: number;
  skipped: number;
  failed: { file: string; title?: string; error: string }[];
};

// ---------- slug 生成（与后台 POST /api/admin/topics 保持一致） ----------
export function toSlug(raw: string, fallbackSeed: string): string {
  const cleaned = (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (/[a-z0-9]/.test(cleaned) && !/[一-龥]/.test(cleaned)) return cleaned;
  return fallbackSeed;
}

// ---------- frontmatter 解析 ----------
function parseFrontmatter(text: string): { data: Record<string, string>; body: string } | null {
  const m = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const raw = m[1];
  const body = (m[2] ?? "").replace(/^\uFEFF/, "");
  const data: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    data[mm[1]] = v;
  }
  return { data, body };
}

// 摘要缺省取正文首段（与现有新建逻辑一致）
function deriveExcerpt(content: string): string {
  return content
    .replace(/[#>*`\-\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 68);
}

// ---------- 解析单篇 markdown 为 draft ----------
export function parseMarkdownTopic(
  raw: string,
  filename = "unknown.md",
  defaultCategory = ""
): ParseResult {
  const text = (raw ?? "").replace(/^\uFEFF/, "");
  const fm = parseFrontmatter(text);

  let title = "";
  let category = "";
  let slug = "";
  let isPremium = false;
  let excerpt = "";
  let content = "";

  if (fm) {
    title = (fm.data.title ?? "").trim();
    category = (fm.data.category ?? "").trim() || defaultCategory || "";
    slug = (fm.data.slug ?? "").trim();
    isPremium = /^(true|1|yes|是)$/i.test(fm.data.isPremium || "");
    excerpt = (fm.data.excerpt ?? "").trim();
    content = fm.body.trim();
  } else {
    // 回退：首个 # 标题
    const lines = text.split(/\r?\n/);
    const h1 = lines.find((l) => l.startsWith("# "));
    title = h1 ? h1.slice(2).trim() : "";
    category = defaultCategory || "";
    content = text.trim();
  }

  if (!title) {
    return { ok: false, error: "缺少标题（frontmatter 的 title，或正文首个 # 标题）" };
  }
  if (!content) {
    return { ok: false, error: "正文为空" };
  }
  if (!category) {
    return { ok: false, error: "缺少分类（frontmatter 的 category，或导入时填写的默认分类）" };
  }

  return {
    ok: true,
    draft: {
      title,
      category,
      slug: slug || "",
      excerpt: excerpt || deriveExcerpt(content),
      content,
      isPremium,
    },
  };
}

// ---------- 整库 bundle 拆分 ----------
export function splitBundle(text: string): string[] {
  if (!text.includes(KB_DOC_SEP)) return [text];
  return text
    .split(KB_DOC_SEP)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------- 导出序列化（draft/topic -> md） ----------
function yamlVal(v: string): string {
  const s = String(v ?? "");
  if (/[:#]/.test(s) || /^\s|\s$/.test(s) || s.includes("\n")) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}

export function serializeTopic(t: {
  title: string;
  category: string;
  slug: string;
  excerpt: string;
  content: string;
  isPremium: boolean;
}): string {
  const fm = [
    "---",
    `title: ${yamlVal(t.title)}`,
    `category: ${yamlVal(t.category)}`,
    `slug: ${yamlVal(t.slug)}`,
    `isPremium: ${t.isPremium ? "true" : "false"}`,
    `excerpt: ${yamlVal(t.excerpt)}`,
    "---",
  ].join("\n");
  return `${fm}\n\n${t.content}\n`;
}

// ---------- 执行导入 ----------
export function importTopics(
  drafts: TopicDraft[],
  mode: "create" | "upsert",
  adminId: string
): ImportReport {
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, failed: [] };
  const used = new Set<string>();

  for (const d of drafts) {
    try {
      // 解析基础 slug
      let baseSlug = d.slug ? toSlug(d.slug, "") : "";
      if (!baseSlug) {
        baseSlug = toSlug(
          d.title,
          `kb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
        );
      }

      // 先看 DB 中是否已存在同 slug 的记录（upsert 命中判定）
      const existing = db.getTopicBySlug(baseSlug);

      if (existing && mode === "create") {
        report.skipped++;
        continue;
      }

      if (existing) {
        // upsert：直接覆盖已存在记录，保留原 slug
        used.add(baseSlug);
        db.updateTopic(existing.id, {
          title: d.title,
          category: d.category,
          excerpt: d.excerpt,
          content: d.content,
          isPremium: d.isPremium,
          slug: baseSlug,
        });
        report.updated++;
      } else {
        // 新建：避开「本批次已用 slug」与「DB 已有 slug」的冲突
        let slug = baseSlug;
        let guard = 0;
        while ((used.has(slug) || db.getTopicBySlug(slug)) && guard++ < 50) {
          slug = `${baseSlug}-${Math.random().toString(36).slice(2, 5)}`;
        }
        used.add(slug);
        db.createTopic({
          id: "t-" + Math.random().toString(36).slice(2, 9),
          slug,
          title: d.title,
          category: d.category,
          excerpt: d.excerpt,
          content: d.content,
          isPremium: d.isPremium,
          authorId: adminId,
          createdAt: new Date().toISOString(),
          views: 0,
        });
        report.created++;
      }
    } catch (e: any) {
      report.failed.push({ file: "(batch)", title: d.title, error: e?.message || "写入失败" });
    }
  }

  return report;
}
