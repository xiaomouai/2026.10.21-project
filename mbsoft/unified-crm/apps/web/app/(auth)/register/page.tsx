import type { Metadata } from "next";
import RegisterForm from "./register-form";

export const metadata: Metadata = { title: "注册" };

export default function RegisterPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            U
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900">UniCRM</span>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">创建账号</h1>
        <p className="text-sm text-slate-500">注册即开通你的组织工作台（首月免费试用）</p>
      </div>
      <RegisterForm />
    </div>
  );
}
