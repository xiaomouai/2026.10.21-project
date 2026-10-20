import { cn } from "../../lib/cn";

/* ------------------------------------------------------------------ */
/* 基础 UI 原语（无状态，可服务端渲染）                                 */
/* ------------------------------------------------------------------ */

type Tone = "indigo" | "green" | "red" | "amber" | "slate" | "blue" | "purple" | "cyan";

const toneMap: Record<Tone, string> = {
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
  green: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
  red: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm",
  amber: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm",
  slate: "bg-slate-200 hover:bg-slate-300 text-slate-800",
  blue: "bg-sky-600 hover:bg-sky-700 text-white shadow-sm",
  purple: "bg-violet-600 hover:bg-violet-700 text-white shadow-sm",
  cyan: "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm",
};

export function buttonClass(tone: Tone = "indigo", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
    "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
    toneMap[tone],
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-9.5 px-4 text-sm"
  );
}

const badgeToneMap: Record<Tone, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeToneMap[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** 状态 → 徽章色（供各业务模块复用） */
export function statusTone(status: string): Tone {
  const s = status.toUpperCase();
  if (s.includes("WON") || s === "DONE" || s === "ACTIVE" || s.includes("SUCCESS") || s === "QUALIFIED" || s === "CONVERTED")
    return "green";
  if (s === "LOST" || s === "FAILED" || s === "CANCELLED" || s === "CHURNED" || s === "UNQUALIFIED" || s === "SUSPENDED")
    return "red";
  if (s === "BLOCKED") return "red";
  if (s === "REVIEW" || s.includes("PROPOSAL") || s === "PAST_DUE") return "amber";
  if (s === "RUNNING" || s === "STARTED" || s === "NEGOTIATION" || s === "CONTACTED" || s === "ANALYSIS")
    return "blue";
  if (s === "OPEN" || s === "NEW" || s === "QUEUED" || s === "TRIALING") return "indigo";
  if (s === "PROSPECT") return "purple";
  if (s === "INACTIVE" || s === "VIEWER") return "slate";
  return "slate";
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition";

export function EmptyState({
  icon,
  title,
  desc,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {desc && <p className="max-w-sm text-xs text-slate-400">{desc}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const iconBg: Record<Tone, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-sky-50 text-sky-600",
    purple: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
        </div>
        {icon && (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconBg[tone])}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-t border-slate-100 px-3 py-2.5 align-middle text-sm text-slate-700", className)}>
      {children}
    </td>
  );
}
