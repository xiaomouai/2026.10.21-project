import { Card } from "./primitives";

/**
 * 查询失败时的明确错误面板（服务端组件，可直接在页面里渲染）。
 *
 * 目的：页面查询失败必须给出可读原因 + 处理建议，绝不留白或无限加载。
 */
export function QueryError({
  title = "数据加载失败",
  error,
  hint,
}: {
  title?: string;
  error: string;
  hint?: string;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50/60 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-600">
          !
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-800">{title}</p>
          <p className="mt-1 break-words text-[13px] leading-relaxed text-rose-700">{error}</p>
          <p className="mt-2 text-xs text-rose-600/80">
            {hint ?? "通常为数据库结构未同步或连接异常；同步后刷新本页即可恢复。"}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** 记录不存在 / 越权访问时的统一展示（不抛 500，避免整页崩） */
export function NotFoundCard({
  title = "未找到该记录",
  desc = "记录不存在，或不属于当前组织（数据按组织隔离）。",
  backHref,
  backText = "返回列表",
}: {
  title?: string;
  desc?: string;
  backHref?: string;
  backText?: string;
}) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{desc}</p>
      {backHref && (
        <a
          href={backHref}
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
        >
          {backText}
        </a>
      )}
    </Card>
  );
}
