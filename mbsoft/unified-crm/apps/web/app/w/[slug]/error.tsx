"use client";

import { useEffect } from "react";

/**
 * 工作台内路由级错误边界。
 * 任何服务端/客户端未捕获异常都落到这里，展示明确错误 + 重试，
 * 不再出现「一直转圈」的无限加载。
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace error]", error);
  }, [error]);

  const msg = error?.message || "未知错误";
  const modelIssue = /is not a function|Cannot read propert|undefined|does not exist/i.test(msg);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-6">
        <p className="text-base font-semibold text-rose-800">页面加载失败</p>
        <p className="mt-2 break-words text-[13px] leading-relaxed text-rose-700">{msg}</p>
        {error?.digest && (
          <p className="mt-1 text-xs text-rose-500">错误摘要：{error.digest}</p>
        )}
        <p className="mt-3 text-xs text-rose-600/80">
          {modelIssue
            ? "多半是数据库结构未同步（缺表或缺字段）。请执行数据库同步后刷新。"
            : "可先重试；若持续失败，请检查数据库连接与服务日志。"}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="inline-flex h-9 items-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700"
          >
            重试
          </button>
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}
