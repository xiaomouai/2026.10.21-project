"use client";

import { useRouter } from "next/navigation";

export default function DeleteButton({ url, label = "删除" }: { url: string; label?: string }) {
  const router = useRouter();
  const del = async () => {
    if (!window.confirm("确认删除？此操作不可撤销。")) return;
    await fetch(url, { method: "DELETE" });
    router.refresh();
  };
  return (
    <button className="admin-del" onClick={del}>
      {label}
    </button>
  );
}
