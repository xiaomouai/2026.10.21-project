"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Topic } from "@/lib/types";
import { mdToHtml } from "@/lib/markdown";
import { formatDateTime } from "@/lib/format";

type Draft = {
  id?: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  isPremium: boolean;
};

type ImportReport = {
  mode: string;
  receivedFiles: number;
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: { file: string; title?: string; error: string }[];
  message: string;
};

const EMPTY: Draft = {
  title: "",
  slug: "",
  category: "",
  excerpt: "",
  content: "",
  isPremium: false,
};

const CONTENT_TPL = `# 标题

一句话说明这篇要解决什么问题。

## 判断/操作的顺序

### ① 第一步
- 要点

### ② 第二步
- 要点

## 一个简单结论

> 结论一句话

*本内容为家庭教育参考，不替代儿科评估。*`;

export default function TopicManager({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [type, setType] = useState<"all" | "free" | "premium">("all");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [deleting, setDeleting] = useState<Topic | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 批量选择 + 导入
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importMode, setImportMode] = useState<"upsert" | "create" | "replace">("upsert");
  const [importDefaultCat, setImportDefaultCat] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(topics.map((t) => t.category))).sort(),
    [topics]
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return topics
      .filter((t) => {
        if (cat && t.category !== cat) return false;
        if (type === "free" && t.isPremium) return false;
        if (type === "premium" && !t.isPremium) return false;
        if (kw && !t.title.toLowerCase().includes(kw) && !t.excerpt.toLowerCase().includes(kw)) return false;
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [topics, q, cat, type]);

  const premiumCount = topics.filter((t) => t.isPremium).length;

  const visibleIds = filtered.map((t) => t.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  }
  function clearSelection() {
    setSelectedIds([]);
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) return setMsg({ ok: false, text: "标题不能为空" });
    if (!draft.category.trim()) return setMsg({ ok: false, text: "分类不能为空" });
    if (!draft.content.trim()) return setMsg({ ok: false, text: "正文不能为空" });

    setBusy(true);
    setMsg(null);
    try {
      const isEdit = !!editingId;
      const res = await fetch(isEdit ? `/api/admin/topics/${editingId}` : "/api/admin/topics", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          slug: draft.slug,
          category: draft.category,
          excerpt: draft.excerpt,
          content: draft.content,
          isPremium: draft.isPremium,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "保存失败" });
        return;
      }
      setMsg({ ok: true, text: data.message || "已保存" });
      setDraft(null);
      setEditingId(null);
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "网络异常，请重试" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Topic) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/topics/${t.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "删除失败" });
        return;
      }
      setMsg({ ok: true, text: data.message });
      setDeleting(null);
      setSelectedIds((prev) => prev.filter((id) => id !== t.id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePremium(t: Topic) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/topics/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPremium: !t.isPremium }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: data.message || "已更新" } : { ok: false, text: data.error });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ---------- 批量维护 ----------
  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 篇教程？此操作不可撤销。`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/topics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: selectedIds }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: data.message } : { ok: false, text: data.error || "删除失败" });
      if (res.ok) {
        clearSelection();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  async function bulkPremium(v: boolean) {
    if (!selectedIds.length) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/topics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "premium", ids: selectedIds, value: v }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: data.message } : { ok: false, text: data.error || "操作失败" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function bulkCategory() {
    if (!selectedIds.length) return;
    const catName = window.prompt(`将选中的 ${selectedIds.length} 篇移动到新分类，请输入分类名：`);
    if (!catName || !catName.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/topics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "category", ids: selectedIds, value: catName.trim() }),
      });
      const data = await res.json();
      setMsg(res.ok ? { ok: true, text: data.message } : { ok: false, text: data.error || "操作失败" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ---------- 导入 / 导出 ----------
  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    setImportFiles(list);
    setImportReport(null);
  }
  async function doImport() {
    if (!importFiles.length) {
      setMsg({ ok: false, text: "请先选择 .md 文件" });
      return;
    }
    if (
      importMode === "replace" &&
      !window.confirm("replace 模式会清空全部现有教程再全量导入，确认继续？")
    ) {
      return;
    }
    setImporting(true);
    setImportReport(null);
    setMsg(null);
    try {
      const fd = new FormData();
      importFiles.forEach((f) => fd.append("files", f));
      fd.append("mode", importMode);
      fd.append("defaultCategory", importDefaultCat);
      const res = await fetch("/api/admin/topics/import", { method: "POST", body: fd });
      const data = await res.json();
      setImportReport(data);
      if (res.ok) {
        setMsg({ ok: true, text: data.message });
        router.refresh();
      } else {
        setMsg({ ok: false, text: data.error || "导入失败" });
      }
    } catch {
      setMsg({ ok: false, text: "网络异常，请重试" });
    } finally {
      setImporting(false);
    }
  }
  function doExport() {
    const a = document.createElement("a");
    a.href = "/api/admin/topics/export";
    a.download = `knowledge-base-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openCreate() {
    setDraft({ ...EMPTY, content: CONTENT_TPL, category: categories[0] ?? "" });
    setEditingId(null);
    setTab("edit");
    setMsg(null);
  }

  function openEdit(t: Topic) {
    setDraft({
      id: t.id,
      title: t.title,
      slug: t.slug,
      category: t.category,
      excerpt: t.excerpt,
      content: t.content,
      isPremium: t.isPremium,
    });
    setEditingId(t.id);
    setTab("edit");
    setMsg(null);
  }

  return (
    <>
      {msg && <div className={`a-alert ${msg.ok ? "a-alert-ok" : "a-alert-err"}`}>{msg.text}</div>}

      <div className="a-card">
        <div className="a-toolbar">
          <input
            className="a-input"
            style={{ minWidth: 200 }}
            placeholder="搜索标题或摘要…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="a-select" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className="a-select" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="all">全部类型</option>
            <option value="free">免费</option>
            <option value="premium">付费</option>
          </select>
          <button className="a-btn a-btn-primary" onClick={openCreate}>
            ＋ 新建教程
          </button>
          <button className="a-btn" onClick={() => { setShowImport(true); setImportReport(null); }}>
            📥 导入 MD
          </button>
          <button className="a-btn" onClick={doExport} title="导出整库为单个 .md（可编辑后再次导入）">
            📤 导出 MD
          </button>
          <span className="a-muted" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
            共 {filtered.length} / {topics.length} 篇 · 付费 {premiumCount} 篇
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="a-bulkbar">
            <span className="a-bulk-count">已选 {selectedIds.length} 篇</span>
            <button className="a-btn a-btn-sm a-btn-danger" disabled={busy} onClick={bulkDelete}>
              删除
            </button>
            <button className="a-btn a-btn-sm" disabled={busy} onClick={() => bulkPremium(true)}>
              设为付费
            </button>
            <button className="a-btn a-btn-sm" disabled={busy} onClick={() => bulkPremium(false)}>
              设为免费
            </button>
            <button className="a-btn a-btn-sm" disabled={busy} onClick={bulkCategory}>
              改分类
            </button>
            <button className="a-btn a-btn-sm" onClick={clearSelection}>
              取消选择
            </button>
          </div>
        )}

        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th className="nowrap">
                  <input
                    type="checkbox"
                    className="a-check"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="全选"
                  />
                </th>
                <th>教程</th>
                <th className="nowrap">分类</th>
                <th className="nowrap">类型</th>
                <th className="nowrap">浏览</th>
                <th className="nowrap">创建时间</th>
                <th className="nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">
                    <input
                      type="checkbox"
                      className="a-check"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      aria-label={`选择 ${t.title}`}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="a-muted" style={{ fontSize: 12 }}>
                      /topics/{t.slug}
                    </div>
                  </td>
                  <td className="nowrap">
                    <span className="a-badge a-badge-violet">{t.category}</span>
                  </td>
                  <td className="nowrap">
                    <button
                      className={`a-badge ${t.isPremium ? "a-badge-amber" : "a-badge-green"}`}
                      style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      onClick={() => togglePremium(t)}
                      disabled={busy}
                      title="点击切换免费 / 付费"
                    >
                      {t.isPremium ? "付费" : "免费"}
                    </button>
                  </td>
                  <td className="nowrap a-mono">{t.views}</td>
                  <td className="nowrap a-muted">{formatDateTime(t.createdAt).slice(0, 10)}</td>
                  <td className="nowrap">
                    <button className="a-btn a-btn-sm" onClick={() => openEdit(t)}>
                      编辑
                    </button>{" "}
                    <Link className="a-btn a-btn-sm" href={`/topics/${t.slug}`} target="_blank" rel="noreferrer">
                      查看
                    </Link>{" "}
                    <button className="a-btn a-btn-sm a-btn-danger" onClick={() => setDeleting(t)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="a-empty">
                    没有符合条件的教程
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- 新建 / 编辑 ---------- */}
      {draft && (
        <div className="a-modal-backdrop" onClick={() => setDraft(null)}>
          <div className="a-modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>{editingId ? "编辑教程" : "新建教程"}</h3>
              <div className="a-card-head-spacer" />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className={`a-btn a-btn-sm ${tab === "edit" ? "a-btn-primary" : ""}`}
                  onClick={() => setTab("edit")}
                >
                  编辑
                </button>
                <button
                  className={`a-btn a-btn-sm ${tab === "preview" ? "a-btn-primary" : ""}`}
                  onClick={() => setTab("preview")}
                >
                  预览
                </button>
              </div>
              <button className="a-close" onClick={() => setDraft(null)}>
                ✕
              </button>
            </div>

            <div className="a-modal-body">
              {tab === "edit" ? (
                <>
                  <div className="a-field">
                    <label htmlFor="t-title">标题 *</label>
                    <input
                      id="t-title"
                      className="a-input"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      placeholder="例如：落地醒不是失败：改放床顺序的第3步就稳了"
                    />
                  </div>
                  <div className="a-row">
                    <div className="a-field" style={{ flex: "1 1 200px" }}>
                      <label htmlFor="t-cat">分类 *</label>
                      <input
                        id="t-cat"
                        className="a-input"
                        list="cat-list"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        placeholder="例如：夜醒排查"
                      />
                      <datalist id="cat-list">
                        {categories.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    <div className="a-field" style={{ flex: "1 1 240px" }}>
                      <label htmlFor="t-slug">链接 slug（可留空自动生成）</label>
                      <input
                        id="t-slug"
                        className="a-input"
                        value={draft.slug}
                        onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                        placeholder="night-waking-4-numbers"
                      />
                    </div>
                  </div>
                  <div className="a-field">
                    <label htmlFor="t-excerpt">摘要（列表页展示，留空自动截取正文）</label>
                    <input
                      id="t-excerpt"
                      className="a-input"
                      value={draft.excerpt}
                      onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
                    />
                  </div>
                  <div className="a-field">
                    <label htmlFor="t-content">正文（Markdown）*</label>
                    <textarea
                      id="t-content"
                      className="a-textarea"
                      style={{ minHeight: 300, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}
                      value={draft.content}
                      onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    />
                    <div className="a-tip">
                      支持 # 标题、- 列表、&gt; 引用、**加粗**、| 表格 |、```代码块；表格在窄屏会自动横向滚动。
                    </div>
                  </div>
                  <label className="a-switch">
                    <input
                      type="checkbox"
                      checked={draft.isPremium}
                      onChange={(e) => setDraft({ ...draft, isPremium: e.target.checked })}
                    />
                    <span className="a-switch-track" />
                    设为付费内容（会员专享）
                  </label>
                </>
              ) : (
                <div className="article">
                  <h1 style={{ fontSize: 22 }}>{draft.title || "（未填写标题）"}</h1>
                  <p className="a-muted">
                    {draft.category || "未分类"} · {draft.isPremium ? "付费内容" : "免费内容"}
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: mdToHtml(draft.content || "") }} />
                </div>
              )}
            </div>

            <div className="a-modal-foot">
              <button className="a-btn" onClick={() => setDraft(null)}>
                取消
              </button>
              <button className="a-btn a-btn-primary" disabled={busy} onClick={save}>
                {busy ? "保存中…" : editingId ? "保存修改" : "创建教程"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 删除确认 ---------- */}
      {deleting && (
        <div className="a-modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="a-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>删除教程</h3>
              <div className="a-card-head-spacer" />
              <button className="a-close" onClick={() => setDeleting(null)}>
                ✕
              </button>
            </div>
            <div className="a-modal-body">
              <div className="a-alert a-alert-err" style={{ marginBottom: 10 }}>
                删除后前台将立即无法访问该教程，操作不可撤销。
              </div>
              <p style={{ margin: 0, fontSize: 14 }}>
                确认删除《<b>{deleting.title}</b>》？
              </p>
            </div>
            <div className="a-modal-foot">
              <button className="a-btn" onClick={() => setDeleting(null)}>
                取消
              </button>
              <button className="a-btn a-btn-danger" disabled={busy} onClick={() => remove(deleting)}>
                {busy ? "删除中…" : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 导入 MD ---------- */}
      {showImport && (
        <div className="a-modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="a-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="a-modal-head">
              <h3>导入 Markdown 知识库</h3>
              <div className="a-card-head-spacer" />
              <button className="a-close" onClick={() => setShowImport(false)}>
                ✕
              </button>
            </div>
            <div className="a-modal-body">
              <div className="a-alert a-alert-info" style={{ marginBottom: 14, lineHeight: 1.7 }}>
                支持 <b>单篇 .md</b>（带 frontmatter）或 <b>整库 .md bundle</b>（多篇用 <code>✂️===KB_DOC===✂️</code> 分隔）。
                单篇格式示例：<br />
                <code>---</code> / <code>title: 标题</code> / <code>category: 分类</code> / <code>slug: 可选</code> /{" "}
                <code>isPremium: false</code> / <code>---</code> 后接正文。无 frontmatter 时取首个 # 标题，分类取下方「默认分类」。
              </div>

              <div className="a-field">
                <label htmlFor="imp-files">选择 .md 文件（可多选）</label>
                <input
                  id="imp-files"
                  type="file"
                  accept=".md,text/markdown"
                  multiple
                  className="a-input"
                  onChange={onPickFiles}
                />
                {importFiles.length > 0 && (
                  <div className="a-tip">已选择 {importFiles.length} 个文件：{importFiles.map((f) => f.name).join("、")}</div>
                )}
              </div>

              <div className="a-row">
                <div className="a-field" style={{ flex: "1 1 200px" }}>
                  <label htmlFor="imp-mode">导入模式</label>
                  <select
                    id="imp-mode"
                    className="a-select"
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                  >
                    <option value="upsert">upsert（按 slug 覆盖更新，推荐）</option>
                    <option value="create">create（仅新增，slug 重复则跳过）</option>
                    <option value="replace">replace（清空全部再全量导入，危险）</option>
                  </select>
                </div>
                <div className="a-field" style={{ flex: "1 1 200px" }}>
                  <label htmlFor="imp-cat">默认分类（md 无 category 时兜底）</label>
                  <input
                    id="imp-cat"
                    className="a-input"
                    list="cat-list"
                    value={importDefaultCat}
                    onChange={(e) => setImportDefaultCat(e.target.value)}
                    placeholder="例如：夜醒排查"
                  />
                </div>
              </div>

              {importReport && (
                <div className="a-card" style={{ marginTop: 14, padding: 14 }}>
                  <div className="a-alert a-alert-ok" style={{ marginBottom: 10 }}>
                    {importReport.message}
                  </div>
                  <div className="a-muted" style={{ fontSize: 13, marginBottom: 6 }}>
                    接收文件 {importReport.receivedFiles} · 解析文档 {importReport.parsed} · 新增{" "}
                    <b>{importReport.created}</b> · 更新 <b>{importReport.updated}</b> · 跳过{" "}
                    <b>{importReport.skipped}</b> · 失败 <b>{importReport.failed.length}</b>
                  </div>
                  {importReport.failed.length > 0 && (
                    <ul className="kb-import-fail">
                      {importReport.failed.slice(0, 20).map((f, i) => (
                        <li key={i}>
                          <b>{f.file}</b>
                          {f.title ? `（${f.title}）` : ""}：{f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="a-modal-foot">
              <button className="a-btn" onClick={() => setShowImport(false)}>
                关闭
              </button>
              <button className="a-btn a-btn-primary" disabled={importing} onClick={doImport}>
                {importing ? "导入中…" : "开始导入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
