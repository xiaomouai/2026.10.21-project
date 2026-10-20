import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { db } from "@/lib/store";
import {
  parseMarkdownTopic,
  splitBundle,
  importTopics,
  ImportReport,
} from "@/lib/kb-import";

// 依赖会话/数据库，禁止构建期静态化（也避免构建期访问 SQLite）
export const dynamic = "force-dynamic";

// 知识库 MD 批量导入
// POST multipart/form-data：
//   files          一个或多个 .md 文件（单篇或整库 bundle 均可）
//   mode           create | upsert | replace（默认 upsert）
//   defaultCategory 当 md 无 category 时的兜底分类
export async function POST(req: NextRequest) {
  const g = adminGuard();
  if (g.kind === "err") return g.res;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求格式错误，请使用 multipart/form-data 上传 .md 文件" }, { status: 400 });
  }

  const mode = String(form.get("mode") || "upsert");
  const defaultCategory = String(form.get("defaultCategory") || "").trim();
  if (!["create", "upsert", "replace"].includes(mode)) {
    return NextResponse.json({ error: "mode 必须是 create / upsert / replace" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "未接收到任何 .md 文件" }, { status: 400 });
  }

  // replace 模式：先清空全部（危险，依赖后台二次确认）
  if (mode === "replace") {
    db.deleteAllTopics();
  }

  const drafts = [];
  const fileErrors: ImportReport["failed"] = [];

  for (const f of files) {
    const name = (f as any).name || "unknown.md";
    if (!name.toLowerCase().endsWith(".md")) {
      fileErrors.push({ file: name, error: "仅支持 .md 文件" });
      continue;
    }
    let text = "";
    try {
      text = await f.text();
    } catch {
      fileErrors.push({ file: name, error: "文件读取失败" });
      continue;
    }
    const chunks = splitBundle(text);
    for (const chunk of chunks) {
      const r = parseMarkdownTopic(chunk, name, defaultCategory);
      if ("draft" in r) drafts.push(r.draft);
      else fileErrors.push({ file: name, error: r.error });
    }
  }

  const report = importTopics(drafts, mode === "replace" ? "create" : (mode as "create" | "upsert"), g.user.id);
  report.failed = [...report.failed, ...fileErrors];

  return NextResponse.json({
    ok: true,
    mode,
    receivedFiles: files.length,
    parsed: drafts.length,
    ...report,
    message:
      mode === "replace"
        ? `已清空并全量导入：新增 ${report.created} 篇`
        : `导入完成：新增 ${report.created} / 更新 ${report.updated} / 跳过 ${report.skipped} / 失败 ${report.failed.length}`,
  });
}
