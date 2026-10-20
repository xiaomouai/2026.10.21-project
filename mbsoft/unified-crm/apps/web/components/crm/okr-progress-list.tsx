import { Card } from "../ui/primitives";
import { fmtMoney, fmtDate } from "../../lib/fmt";
import type { OkrProgressRow } from "../../lib/crm/okr";

const pct = (a: number, t: number) => (t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 0);

/** OKR 进度卡片列表（纯展示，服务端渲染） */
export function OkrProgressList({ rows }: { rows: OkrProgressRow[] }) {
  return (
    <div className="space-y-5">
      {rows.map((row) => (
        <Card key={row.id} className="p-5">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">{row.name}</h2>
              <p className="text-xs text-slate-400">
                {fmtDate(row.startDate)} 至 {fmtDate(row.endDate)}
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
              目标 {fmtMoney(row.targetAmount)}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {(
              [
                ["销售额", row.actual.amount, row.targetAmount, fmtMoney],
                ["客户", row.actual.companies, row.targetCompanies, String],
                ["线索", row.actual.leads, row.targetLeads, String],
                ["商机", row.actual.opportunities, row.targetOpportunities, String],
              ] as [string, number, number, (v: number) => string][]
            ).map(([label, value, target, format]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{label}</span>
                  <span>{pct(value, target)}%</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {format(value)}
                  <span className="ml-1 text-xs font-normal text-slate-400">/ {format(target)}</span>
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500"
                    style={{ width: `${pct(value, target)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold text-slate-600">日 / 周 / 月进度统计</h3>
            <div className="grid gap-2 md:grid-cols-3">
              {row.stats.map((s) => (
                <div key={s.period} className="rounded-lg border border-slate-100 p-3 text-xs">
                  <p className="font-medium text-slate-700">按{s.period}累计</p>
                  <p className="mt-1 text-slate-500">
                    销售额 {fmtMoney(s.amount)} · 客户 {s.companies} · 线索 {s.leads} · 商机{" "}
                    {s.opportunities}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
