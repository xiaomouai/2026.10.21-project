"use client";

import { useState } from "react";
import { generateDraftAction, listDraftsAction } from "../../lib/actions/draft";
import { Card, Badge } from "../ui/primitives";
import type { DraftTargetType } from "../../lib/ai/draft";

type D = {
  ok: boolean;
  error?: string;
  subject: string;
  body: string;
  mode: "rule" | "llm";
  citations: { label: string; source: string }[];
};

export function AiDraftGenerator({ slug }: { slug: string }) {
  const [targetType, setTargetType] = useState<DraftTargetType>("CONTACT");
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<D | null>(null);
  const [history, setHistory] = useState<
    { runId: string; targetType: string; targetId: string; subject: string; mode: string; startedAt: string }[]
  >([]);
  const [err, setErr] = useState("");

  async function gen() {
    if (!targetId.trim()) {
      setErr("请填写目标 ID（联系人或线索的 ID）");
      return;
    }
    setLoading(true);
    setErr("");
    const r = await generateDraftAction(slug, targetType, targetId.trim());
    setLoading(false);
    if (!r.ok) {
      setErr(r.error ?? "生成失败");
      return;
    }
    setDraft({
      ok: r.ok,
      error: r.error,
      subject: r.subject,
      body: r.body,
      mode: r.mode,
      citations: r.citations ?? [],
    });
    const h = await listDraftsAction(slug);
    setHistory(h.map((x) => ({ ...x, startedAt: new Date(x.startedAt).toISOString() })));
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-medium text-slate-900">邮件草稿生成器</h3>
        <Badge tone="amber">只读 · 不发送</Badge>
      </div>
      <p className="mt-1 text-[12px] text-slate-500">
        为联系人/线索生成中文跟进邮件草稿，复用建档上下文（行业/规模/官网）。草稿落 AgentRun，供人工采纳。
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-[12px] text-slate-500">
          目标类型
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as DraftTargetType)}
            className="ml-1 rounded-md border border-slate-200 px-2 py-1.5 text-[13px] text-slate-900"
          >
            <option value="CONTACT">联系人</option>
            <option value="LEAD">线索</option>
          </select>
        </label>
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="目标 ID"
          className="w-56 rounded-md border border-slate-200 px-2 py-1.5 text-[13px] text-slate-900 outline-none focus:border-slate-400"
        />
        <button
          onClick={gen}
          disabled={loading}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {loading ? "生成中…" : "生成草稿"}
        </button>
      </div>

      {err && <p className="mt-2 text-[12px] text-rose-600">{err}</p>}

      {draft && draft.ok && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-900">主题：{draft.subject}</span>
            <Badge tone={draft.mode === "llm" ? "green" : "amber"}>
              {draft.mode === "llm" ? "LLM 润色" : "规则模板"}
            </Badge>
          </div>
          <pre className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700">
            {draft.body}
          </pre>
          {draft.citations.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2">
              <div className="text-[11px] font-medium text-slate-500">信息溯源</div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                {draft.citations.map((c, i) => (
                  <li key={i}>
                    · {c.label} —— <span className="text-slate-400">{c.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <div className="text-[12px] font-medium text-slate-500">历史草稿（最近 20 条）</div>
          <ul className="mt-1 space-y-1">
            {history.map((h) => (
              <li key={h.runId} className="flex items-center gap-2 text-[12px] text-slate-600">
                <Badge tone={h.mode === "llm" ? "green" : "amber"}>{h.targetType}</Badge>
                <span className="truncate">{h.subject}</span>
                <span className="ml-auto text-slate-400">
                  {new Date(h.startedAt).toLocaleString("zh-CN", { hour12: false })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
