import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            U
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900">UniCRM</span>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">登录工作台</h1>
        <p className="text-sm text-slate-500">中小企业一体化 CRM · SaaS</p>
      </div>
      <LoginForm />
    </div>
  );
}
