"use client";

import { useState } from "react";
import { runReminderScanAction, type ReminderScanResult } from "../../lib/actions/reminder";
import { Bell, AlertTriangle, Clock } from "lucide-react";

export function AiRemindersCard({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReminderScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await runReminderScanAction(slug);
      if (!r.ok) {
        setErr(r.error || "扫描失败");
        return;
      }
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  const reminders = data?.reminders ?? [];
  const high = reminders.filter((r) => r.priority === "high").length;

  return (
    <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="size-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-800">AI 跟进提醒</h2>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">Agent 主动扫描</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          <Bell className="size-3.5" />
          {loading ? "扫描中" : "运行跟进提醒"}
        </button>
        {data && (
          <span className="text-xs text-slate-500">
            {reminders.length} 条 · 高优先 {high} · 扫描于 {new Date(data.scannedAt).toLocaleString("zh-CN")}
          </span>
        )}
      </div>

      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>}

      {reminders.length === 0 && data && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          🎉 未来 7 天无临期商机，也无未完成待办。
        </p>
      )}

      {reminders.length > 0 && (
        <ul className="mt-3 space-y-2">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-white/80 px-3 py-2"
            >
              {r.priority === "high" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
              ) : (
                <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-800">
                  {r.entityType === "OPPORTUNITY" ? (
                    <a href={`/w/${slug}/crm/opportunities`} className="hover:underline">
                      {r.title}
                    </a>
                  ) : r.entityType === "OKR" ? (
                    <a href={`/w/${slug}/sales/okr`} className="hover:underline">{r.title}</a>
                  ) : (
                    <a href={`/w/${slug}/crm/activities`} className="hover:underline">
                      {r.title}
                    </a>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{r.reason}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                  r.priority === "high" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-700"
                }`}
              >
                {r.priority === "high" ? "高优先" : "待办"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        扫描逻辑：开放商机预计 7 天内成交 → 高优先提醒；未完成 TASK 待办 → 待办提醒。仅读取，不自动改动任何业务数据。
      </p>
    </div>
  );
}
