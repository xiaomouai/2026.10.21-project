"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AGENT_JOB_STATUS_LABELS } from "@ucrm/db/constants";
import { setJobStatus } from "../../lib/actions/agentJob";
import { buttonClass } from "../ui/primitives";

const TRANSITIONS: { from: string; to: string; label: string; tone: "indigo" | "amber" | "green" | "red" }[] = [
  { from: "QUEUED", to: "RUNNING", label: "开始", tone: "indigo" },
  { from: "RUNNING", to: "REVIEW", label: "交复核", tone: "amber" },
  { from: "REVIEW", to: "DONE", label: "完成", tone: "green" },
  { from: "RUNNING", to: "BLOCKED", label: "受阻", tone: "red" },
  { from: "BLOCKED", to: "RUNNING", label: "恢复", tone: "indigo" },
  { from: "REVIEW", to: "FAILED", label: "标记失败", tone: "red" },
];

const ALL_STATUS = Object.keys(AGENT_JOB_STATUS_LABELS);

export function JobStatusControl({ slug, jobId, status }: { slug: string; jobId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function apply(next: string) {
    setBusy(next);
    start(async () => {
      const res = await setJobStatus(slug, jobId, next);
      void res;
      setBusy(null);
      router.refresh();
    });
  }

  const terminal = status === "DONE" || status === "FAILED";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!terminal &&
        TRANSITIONS.filter((t) => t.from === status).map((t) => (
          <button
            key={t.to}
            type="button"
            disabled={pending}
            onClick={() => apply(t.to)}
            className={buttonClass(t.tone, "sm")}
          >
            {busy === t.to ? "…" : t.label}
          </button>
        ))}
      {terminal && (
        <select
          defaultValue={status}
          onChange={(e) => {
            const v = e.target.value;
            if (v !== status) apply(v);
          }}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          <option value={status}>{AGENT_JOB_STATUS_LABELS[status as keyof typeof AGENT_JOB_STATUS_LABELS] ?? status}</option>
          {ALL_STATUS.filter((s) => s !== status).map((s) => (
            <option key={s} value={s}>
              {AGENT_JOB_STATUS_LABELS[s as keyof typeof AGENT_JOB_STATUS_LABELS]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
