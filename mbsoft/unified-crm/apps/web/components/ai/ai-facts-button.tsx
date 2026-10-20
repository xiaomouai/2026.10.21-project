"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, X } from "lucide-react";
import { Modal } from "../ui/modal";
import { Badge, buttonClass } from "../ui/primitives";
import {
  enrichEntityAction,
  listFactsAction,
  applyFactAction,
  dismissFactAction,
} from "../../lib/actions/aiFact";

/** 从 Server Action 返回类型推导，避免在 "use server" 文件中导出类型 */
type ListResult = Awaited<ReturnType<typeof listFactsAction>>;
type FactRow = ListResult["facts"][number];
type RunInfo = ListResult["run"];

const FIELD_LABELS: Record<string, string> = {
  score: "评分建议",
  note: "跟进建议",
  industry: "行业",
  size: "团队规模",
  website: "官网",
};

const EVIDENCE_LABELS: Record<string, string> = {
  user_provided: "用户亲填",
  gov_registry: "工商/政府公开",
  official_site: "官网",
  third_party_db: "第三方数据库",
  news: "新闻媒体",
  social: "社媒/公开资料",
  llm_knowledge: "模型先验",
  rule_infer: "本地规则",
};

const BAND_TONE: Record<string, "green" | "amber" | "slate"> = {
  VERIFIED: "green",
  PROBABLE: "amber",
  POSSIBLE: "slate",
};

const BAND_LABEL: Record<string, string> = {
  VERIFIED: "已核实",
  PROBABLE: "较可信",
  POSSIBLE: "待验证",
};

const STATUS_LABEL: Record<string, string> = {
  PROPOSED: "待确认",
  APPLIED: "已采纳",
  SUPERSEDED: "已取代",
  DISMISSED: "已忽略",
};

const REASON_LABEL: Record<string, string> = {
  humanOwns: "人填值优先，AI 未覆盖",
  lowConfidence: "置信度不足",
  dismissed: "人工忽略",
  superseded: "被更新的提案取代",
};

export function AiFactsButton({
  slug,
  entityType,
  entityId,
  aiStatus,
  pendingCount = 0,
}: {
  slug: string;
  entityType: "LEAD" | "COMPANY";
  entityId: string;
  aiStatus: string;
  pendingCount?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<FactRow[]>([]);
  const [run, setRun] = useState<RunInfo>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    startTransition(async () => {
      const r = await listFactsAction(slug, entityType, entityId);
      if (r.ok) {
        setFacts(r.facts);
        setRun(r.run);
      }
    });

  const openPanel = () => {
    setMsg(null);
    setOpen(true);
    load();
  };

  const enrich = (force: boolean) =>
    startTransition(async () => {
      const r = await enrichEntityAction(slug, entityType, entityId, force);
      setMsg(r.error ?? r.message ?? null);
      const l = await listFactsAction(slug, entityType, entityId);
      if (l.ok) {
        setFacts(l.facts);
        setRun(l.run);
      }
      router.refresh();
      setOpen(true);
    });

  const decide = (id: string, apply: boolean) =>
    startTransition(async () => {
      const r = apply ? await applyFactAction(slug, id) : await dismissFactAction(slug, id);
      setMsg(r.error ?? r.message ?? null);
      const l = await listFactsAction(slug, entityType, entityId);
      if (l.ok) {
        setFacts(l.facts);
        setRun(l.run);
      }
      router.refresh();
    });

  const trigger =
    pendingCount > 0 ? (
      <button type="button" onClick={openPanel} className="inline-flex items-center gap-1">
        <Badge tone="amber">待审 {pendingCount}</Badge>
      </button>
    ) : aiStatus === "ENRICHED" ? (
      <button type="button" onClick={openPanel} className="inline-flex items-center gap-1">
        <Badge tone="green">已建档</Badge>
      </button>
    ) : (
      <button
        type="button"
        onClick={openPanel}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-indigo-600"
      >
        <Sparkles className="size-3.5" />
        AI 建档
      </button>
    );

  return (
    <>
      {trigger}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="AI 建档提案"
        desc="AI 只提案，不直接改数据；确认后才写入，并保留证据与来源"
      >
        <div className="space-y-3">
          {run && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
              <p>
                模式：{run.mode === "llm" ? "LLM 推断" : "规则推断（降级）"} · {run.provider} / {run.model}
                {run.durationMs != null && ` · ${run.durationMs}ms`}
              </p>
              {run.note && <p className="mt-1 text-slate-500">{run.note}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => enrich(false)} disabled={pending} className={buttonClass("indigo", "sm")}>
              {pending ? "执行中…" : "AI 建档"}
            </button>
            <button type="button" onClick={() => enrich(true)} disabled={pending} className={buttonClass("slate", "sm")}>
              强制重跑
            </button>
          </div>

          {msg && <p className="text-[13px] text-rose-600">{msg}</p>}

          {facts.length === 0 ? (
            <p className="py-2 text-[13px] text-slate-500">暂无提案。点「AI 建档」让 Agent 基于现有信息补全档案。</p>
          ) : (
            <div className="space-y-2">
              {facts.map((f) => (
                <div key={f.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-slate-900">
                      {FIELD_LABELS[f.field] ?? f.field}
                    </span>
                    <span className="text-[13px] text-indigo-600">{f.value}</span>
                    <Badge tone={BAND_TONE[f.band] ?? "slate"}>
                      {BAND_LABEL[f.band] ?? f.band} {f.confidence.toFixed(2)}
                    </Badge>
                    {f.status !== "PROPOSED" && (
                      <Badge tone={f.status === "APPLIED" ? "green" : "slate"}>
                        {STATUS_LABEL[f.status] ?? f.status}
                      </Badge>
                    )}
                  </div>

                  {f.currentValue ? (
                    <p className="mt-1 text-[12px] text-slate-400">原值：{f.currentValue}</p>
                  ) : (
                    <p className="mt-1 text-[12px] text-slate-400">原值：空</p>
                  )}

                  {f.reason && f.status === "DISMISSED" && (
                    <p className="mt-1 text-[12px] text-amber-600">{REASON_LABEL[f.reason] ?? f.reason}</p>
                  )}

                  {f.evidence.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {f.evidence.map((e, i) => (
                        <li key={i} className="text-[12px] text-slate-500">
                          · {EVIDENCE_LABELS[e.type] ?? e.type}
                          {e.snippet ? `：${e.snippet}` : ""}
                          {e.sourceUrl && (
                            <a
                              href={e.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1 text-indigo-600 hover:underline"
                            >
                              查看来源
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {f.status === "PROPOSED" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => decide(f.id, true)}
                        disabled={pending}
                        className={buttonClass("green", "sm")}
                      >
                        <Check className="size-3.5" />
                        采纳
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(f.id, false)}
                        disabled={pending}
                        className={buttonClass("slate", "sm")}
                      >
                        <X className="size-3.5" />
                        忽略
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
