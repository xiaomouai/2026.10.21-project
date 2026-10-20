"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "../../../lib/auth-client";
import { Field, inputClass } from "../../../components/ui/primitives";
import { FormMessage } from "../../../components/ui/modal";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const { error: err } = await authClient.signIn.email({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    if (err) {
      setError(err.message || "登录失败，请检查邮箱与密码");
      setLoading(false);
      return;
    }
    router.push("/resolve");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="邮箱">
        <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className={inputClass} />
      </Field>
      <Field label="密码">
        <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className={inputClass} />
      </Field>
      <FormMessage text={error} />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "登录中…" : "登录"}
      </button>
      <p className="text-center text-sm text-slate-500">
        还没有账号？{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          注册
        </Link>
      </p>
    </form>
  );
}
