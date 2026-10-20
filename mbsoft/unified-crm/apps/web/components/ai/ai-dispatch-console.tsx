"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, PlayCircle, Layers, Building2, Magnet } from "lucide-react";
import { Badge, buttonClass, StatCard } from "../ui/primitives";
import {
  enqueueBulkEnrichAction,
  dispatchNowAction,
  queueHealthAction,
} from "../../lib/actions/aiFact";

type Health = { queued: number; running: number; stalled: number; failed: number; done: number };

/**
 * Agent 调度台 [AI·NEW · P1]
 * 把「批量建档」压入 fast 泳道租约队列，再点「运行调度器」领取到期任务执行。
 * 队列健康实时展示，便于演示租约回收 / 重试 / 双泳道。
 */
export function AiDispatchConsole({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [health, setHealth] = useState<Health | null>(null);
  const [lane, setLane] = useState<"fast" | "llm">("fast");
  const [msg, setMsg] = useState<string | null>(null);

  const refreshHealth = () =>
    queueHealthAction(slug).then((h) => setHealth(h as Health));

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setMsg(r.error ?? r.message ?? null);
      await refreshHealth();
      router.refresh();
    });

  const enqueue = (entityType: "LEAD" | "COMPANY") =>
    run(() => enqueueBulkEnrichAction(slug, entityType));

  const dispatch = () => run(() => dispatchNowAction(slug, 20, lane));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="排队中" value={health?.queued ?? "—"} tone="indigo" />
        <StatCard label="执行中" value={health?.running ?? "—"} tone="blue" />
        <StatCard label="卡死(租约过期)" value={health?.stalled ?? "—"} tone="amber" />
        <StatCard label="已完成" value={health?.done ?? "—"} tone="green" />
        <StatCard label="失败" value={health?.failed ?? "—"} tone="red" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => enqueue("COMPANY")}
            disabled={pending}
            className={buttonClass("indigo", "sm")}
          >
            <Building2 className="size-3.5" />
            企业批量建档
          </button>
          <button
            type="button"
            onClick={() => enqueue("LEAD")}
            disabled={pending}
            className={buttonClass("indigo", "sm")}
          >
            <Magnet className="size-3.5" />
            线索批量建档
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() => setLane("fast")}
                className={`rounded-md px-2 py-1 ${lane === "fast" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
              >
                <Layers className="mr-1 inline size-3" />
                fast 泳道
              </button>
              <button
                type="button"
                onClick={() => setLane("llm")}
                className={`rounded-md px-2 py-1 ${lane === "llm" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
              >
                <Layers className="mr-1 inline size-3" />
                llm 泳道
              </button>
            </div>
            <button
              type="button"
              onClick={dispatch}
              disabled={pending}
              className={buttonClass("green", "sm")}
            >
              <PlayCircle className="size-3.5" />
              运行调度器
            </button>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[12px] leading-relaxed text-slate-500">
          <ListChecks className="size-3.5" />
          批量建档走 fast 泳道（仅本地规则，便宜可控）；llm 泳道才会调用模型。租约到期未完成的任务会被自动回收重排，超重试上限转失败。
        </p>

        {msg && (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{msg}</p>
        )}
      </div>
    </div>
  );
}
