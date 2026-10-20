export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** 毫秒 → 人类可读耗时 */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m${rs ? `${rs}s` : ""}`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

/** 金额格式化（默认人民币） */
export function fmtMoney(v: number | string | { toNumber?: () => number } | null | undefined, currency = "CNY") {
  const n =
    v == null
      ? 0
      : typeof v === "number"
        ? v
        : typeof v === "string"
          ? Number(v)
          : typeof v.toNumber === "function"
            ? v.toNumber()
            : Number(v);
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(n)}`;
}
