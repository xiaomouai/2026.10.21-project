"use client";

import { useState } from "react";
import { askCrmAction } from "../../lib/actions/askCrm";
import { Sparkles, Send } from "lucide-react";

const SAMPLES = [
  "我们一共有多少家企业客户？",
  "当前开放商机的总金额是多少？",
  "本周有哪些商机临近成交需要跟进？",
  "AI 智能建档补全了多少条记录？",
];

export function AskCrm({ slug }: { slug: string }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [mode, setMode] = useState<string>("");
  const [cites, setCites] = useState<{ label: string; sourceUrl: string | null }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setLoading(true);
    setErr(null);
    setAnswer(null);
    setCites([]);
    setQ(text);
    try {
      const r = await askCrmAction(slug, text);
      if (!r.ok) {
        setErr(r.error || "查询失败");
        return;
      }
      setAnswer(r.answer);
      setMode(r.mode);
      setCites(r.citations.map((c) => ({ label: c.label, sourceUrl: c.sourceUrl })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-800">问 CRM · 自然语言查询</h2>
        <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-600">
          只读 · 按组织隔离
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="例如：当前开放商机的总金额是多少？"
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {loading ? "查询中" : "问"}
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}

      {answer && (
        <div className="mt-3 rounded-lg border border-slate-100 bg-white/80 px-3.5 py-3">
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{answer}</p>
          {cites.length > 0 && (
            <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2">
              {cites.map((c, i) => (
                <p key={i} className="flex items-start gap-1 text-[11px] text-amber-600">
                  <span>🔎</span>
                  <span>
                    {c.label}
                    {c.sourceUrl ? (
                      <>
                        {" · "}
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                          证据
                        </a>
                      </>
                    ) : null}
                  </span>
                </p>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            由 {mode === "llm" ? "LLM 润色（数据真实）" : "规则引擎"} 生成 · 答案可溯源
          </p>
        </div>
      )}
    </div>
  );
}
