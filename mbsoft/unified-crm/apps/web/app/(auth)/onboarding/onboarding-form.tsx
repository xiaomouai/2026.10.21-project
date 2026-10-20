"use client";

import { useActionState } from "react";
import { createOrgAction } from "./actions";
import { Field, inputClass } from "../../../components/ui/primitives";

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createOrgAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="组织 / 公司名称" hint="例如：杭州云帆贸易有限公司">
        <input name="name" required maxLength={60} placeholder="公司名称" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="所属行业">
          <select name="industry" className={inputClass} defaultValue="">
            <option value="">未选择</option>
            <option>贸易 / 零售</option>
            <option>制造</option>
            <option>软件 / 互联网</option>
            <option>专业服务</option>
            <option>教育培训</option>
            <option>其他</option>
          </select>
        </Field>
        <Field label="团队规模">
          <select name="size" className={inputClass} defaultValue="1-10">
            <option>1-10</option>
            <option>11-50</option>
            <option>51-200</option>
            <option>200+</option>
          </select>
        </Field>
      </div>
      {state?.error && <p className="text-[13px] text-rose-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "创建中…" : "创建并进入工作台"}
      </button>
    </form>
  );
}
