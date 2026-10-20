"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, inputClass } from "../ui/primitives";

type CreateOkrAction = (slug: string, fd: FormData) => Promise<{ ok: boolean; error?: string }>;

/**
 * 新建销售 OKR 表单（客户端组件）。
 * 与旧版直接用 server action 的内联表单相比：校验失败会明确显示原因，不再静默。
 */
export function OkrForm({ slug, action }: { slug: string; action: CreateOkrAction }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await action(slug, fd);
      if (!res.ok) {
        setError(res.error || "保存失败");
        return;
      }
      setError(null);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="grid gap-3 md:grid-cols-4">
      <input
        name="name"
        required
        placeholder="例如：2026 Q4 销售目标"
        className={`${inputClass} md:col-span-2`}
      />
      <input
        name="targetAmount"
        type="number"
        min="0"
        step="0.01"
        required
        placeholder="销售额目标（元）"
        className={inputClass}
      />
      <input
        name="averageDealAmount"
        type="number"
        min="1"
        required
        placeholder="客单价（元），如 2000"
        className={inputClass}
      />
      <input name="startDate" type="date" required className={inputClass} />
      <input name="endDate" type="date" required className={inputClass} />
      <input
        name="leadToOpportunityRate"
        type="number"
        min="1"
        max="100"
        defaultValue="20"
        required
        placeholder="线索→商机 %"
        className={inputClass}
      />
      <input
        name="opportunityToWonRate"
        type="number"
        min="1"
        max="100"
        defaultValue="25"
        required
        placeholder="商机→成交 %"
        className={inputClass}
      />
      <p className="text-xs text-slate-500 md:col-span-2">
        数量目标自动计算：成交客户 = 销售额 ÷ 客单价；商机 = 成交客户 ÷ 商机成交率；线索 = 商机 ÷
        线索转商机率。
      </p>
      <div className="md:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass("indigo")}>
          {pending ? "保存中…" : "自动拆解并保存"}
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-600 md:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
