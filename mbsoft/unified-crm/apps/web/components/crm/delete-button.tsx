"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ action }: { action: () => Promise<{ ok: boolean; error?: string }> }) {
  const router = useRouter(); const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => { if (!window.confirm("确认删除这条记录？关联记录可能同时受影响。")) return; start(async () => { await action(); router.refresh(); }); }} className="text-xs text-rose-500 hover:text-rose-700 disabled:opacity-50">{pending ? "删除中" : "删除"}</button>;
}
