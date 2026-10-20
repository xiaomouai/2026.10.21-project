"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * 轻量弹窗容器。用法：把 <form action={serverAction}> 内容作为 children，
 * 通过 actionRef 传入来自服务端的 Server Action 引用。
 */
export function Modal({
  trigger,
  title,
  desc,
  children,
  open: openProp,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  desc?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const open = openProp ?? internal;

  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternal(v);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {trigger && <div onClick={() => setOpen(true)}>{trigger}</div>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:py-12">
          <div className="relative w-full max-w-lg rounded-2xl bg-surface shadow-xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-fg">{title}</h3>
                {desc && <p className="mt-0.5 text-xs text-fg-muted">{desc}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="关闭"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

/** 表单行内错误/成功提示 */
export function FormMessage({ text, tone = "error" }: { text?: string | null; tone?: "error" | "ok" }) {
  if (!text) return null;
  return (
    <p className={cn("mt-2 text-[13px]", tone === "error" ? "text-rose-600" : "text-emerald-600")}>{text}</p>
  );
}
