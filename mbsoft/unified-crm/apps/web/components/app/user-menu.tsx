"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import { authClient } from "../../lib/auth-client";

export function UserMenu({
  name,
  email,
  orgName,
}: {
  name: string;
  email: string;
  orgName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-40 truncate text-[13px] font-medium text-slate-800">{name}</span>
          <span className="block max-w-40 truncate text-[11px] text-slate-400">{orgName}</span>
        </span>
        <ChevronDown className="size-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-800">{name}</p>
              <p className="truncate text-xs text-slate-400">{email}</p>
            </div>
            <button
              onClick={logout}
              disabled={busy}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut className="size-4" />
              {busy ? "退出中…" : "退出登录"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
