"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "../../../lib/auth-client";
import { Field, inputClass } from "../../../components/ui/primitives";
import { FormMessage } from "../../../components/ui/modal";

export default function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name"));
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    if (password.length < 8) {
      setError("密码至少 8 位");
      setLoading(false);
      return;
    }
    const { error: err } = await authClient.signUp.email({ name, email, password });
    if (err) {
      setError(err.message || "注册失败");
      setLoading(false);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="姓名 / 团队负责人">
        <input name="name" required autoComplete="name" placeholder="张三" className={inputClass} />
      </Field>
      <Field label="邮箱">
        <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className={inputClass} />
      </Field>
      <Field label="密码" hint="至少 8 位">
        <input name="password" type="password" required autoComplete="new-password" placeholder="••••••••" className={inputClass} />
      </Field>
      <FormMessage text={error} />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "创建中…" : "创建账号"}
      </button>
      <p className="text-center text-sm text-slate-500">
        已有账号？{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          去登录
        </Link>
      </p>
    </form>
  );
}
