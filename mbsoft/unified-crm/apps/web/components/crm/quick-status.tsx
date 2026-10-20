"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** 行内状态快捷切换（企业 / 线索 / 商机 / 跟进通用） */
export function QuickStatus({
  action,
  current,
  options,
}: {
  action: (next: string) => Promise<{ ok: boolean; error?: string }>;
  current: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(v: string) {
    if (v === current) return;
    start(async () => {
      await action(v);
      router.refresh();
    });
  }

  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
