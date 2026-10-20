import Link from "next/link";
import { AlertTriangle, Clock, Bell, CheckCircle2, Building2, Target } from "lucide-react";
import { Card } from "../ui/primitives";
import { QueryError } from "../ui/query-error";
import { fmtDateTime } from "../../lib/fmt";
import {
  REMINDER_KIND_LABEL,
  type ReminderItem,
  type ReminderKind,
  type ReminderScan,
} from "../../lib/crm/reminders";

const KIND_TONE: Record<ReminderKind, string> = {
  OVERDUE: "bg-rose-100 text-rose-700",
  DUE_SOON: "bg-amber-100 text-amber-700",
  NO_FOLLOWUP: "bg-orange-100 text-orange-700",
  OPPORTUNITY: "bg-indigo-100 text-indigo-700",
  OKR: "bg-violet-100 text-violet-700",
};

const KIND_ICON: Record<ReminderKind, React.ComponentType<{ className?: string }>> = {
  OVERDUE: AlertTriangle,
  DUE_SOON: Clock,
  NO_FOLLOWUP: Building2,
  OPPORTUNITY: Target,
  OKR: Bell,
};

function Row({ r }: { r: ReminderItem }) {
  const Icon = KIND_ICON[r.kind];
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${r.priority === "high" ? "text-rose-500" : "text-amber-500"}`}
      />
      <div className="min-w-0 flex-1">
        <Link href={r.href} className="truncate text-[13px] font-medium text-slate-800 hover:underline">
          {r.title}
        </Link>
        <p className="truncate text-xs text-slate-500">{r.reason}</p>
        {r.at && <p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(r.at)}</p>}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${KIND_TONE[r.kind]}`}>
        {REMINDER_KIND_LABEL[r.kind]}
      </span>
    </li>
  );
}

/**
 * 提醒中心（服务端组件，无客户端状态）
 * 工作台登录即渲染 —— 不需要用户手动点「运行扫描」。
 */
export function ReminderCenter({
  scan,
  error,
  limit = 12,
}: {
  scan: ReminderScan | null;
  error?: string | null;
  limit?: number;
}) {
  if (error) {
    return <QueryError title="提醒中心加载失败" error={error} />;
  }
  if (!scan) return null;

  const items = scan.items.slice(0, limit);
  const hidden = scan.items.length - items.length;
  const high = scan.items.filter((r) => r.priority === "high").length;

  return (
    <Card className="border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Bell className="size-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-slate-800">提醒中心</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
          到期 / 逾期 / {7} 天未跟进
        </span>
        <span className="ml-auto text-xs text-slate-500">
          共 {scan.items.length} 条 · 高优先 {high} 条 · 更新于 {fmtDateTime(scan.scannedAt)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(REMINDER_KIND_LABEL) as ReminderKind[]).map((k) => (
          <span
            key={k}
            className={`rounded-full px-2 py-0.5 text-[11px] ${scan.counts[k] > 0 ? KIND_TONE[k] : "bg-slate-100 text-slate-400"}`}
          >
            {REMINDER_KIND_LABEL[k]} {scan.counts[k]}
          </span>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" />
          暂无逾期、到期与 7 天未跟进事项。
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <Row key={`${r.kind}-${r.id}`} r={r} />
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">另有 {hidden} 条未展示，处理完上述事项后可见。</p>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        规则：未完成跟进过截止时间 → 逾期；计划时间在 24 小时内 → 即将到期；活跃客户 7 天无跟进记录 →
        未跟进提醒。仅读取，不自动改动任何业务数据。
      </p>
    </Card>
  );
}
