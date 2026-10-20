import type { Metadata } from "next";
import OnboardingForm from "./onboarding-form";

export const metadata: Metadata = { title: "创建组织" };

export default function OnboardingPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          U
        </div>
        <span className="text-lg font-semibold tracking-tight text-slate-900">UniCRM</span>
      </div>
      <h1 className="mt-5 text-lg font-semibold text-slate-900">创建你的组织</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        一个组织即一个租户，拥有独立的客户数据与 AI Agent 协作空间。
      </p>
      <OnboardingForm />
    </div>
  );
}
