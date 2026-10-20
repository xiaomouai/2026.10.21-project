"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

interface ScoreCol {
  id: string;
  score: string;
  odds: string;
}

// 默认沿用分配金额表：比分 9.5 / 10 / 11 / 12 / 13 / 14，
// 赔率 1.94 / 8.3 / 9.4 / 11 / 14 / 17，固定金额 1940
// （1940 ÷ 1.94 = 1000、1940 ÷ 8.3 = 233.7349 … 与表格一致）
const defaultCols: ScoreCol[] = [
  { id: "s1", score: "9.5", odds: "1.94" },
  { id: "s2", score: "10", odds: "8.3" },
  { id: "s3", score: "11", odds: "9.4" },
  { id: "s4", score: "12", odds: "11" },
  { id: "s5", score: "13", odds: "14" },
  { id: "s6", score: "14", odds: "17" },
];

const DEFAULT_AMOUNT = "1940";
const STORAGE_KEY = "dsby-score-table-v2";

// 去掉浮点小数尾巴：1000.0000 -> 1000，233.7349 -> 233.7349
const trimNum = (n: number, d: number) => {
  if (!Number.isFinite(n)) return "-";
  if (n === 0) return "0";
  const s = n.toFixed(d);
  return s.indexOf(".") >= 0
    ? s.replace(/0+$/, "").replace(/\.$/, "")
    : s;
};

export default function ScorePage() {
  const router = useRouter();
  const [cols, setCols] = useState<ScoreCol[]>(defaultCols);
  const [fixedAmount, setFixedAmount] = useState(DEFAULT_AMOUNT);
  const [loading, setLoading] = useState(true);

  // 登录态校验（与 /profile 一致）
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          router.replace("/auth");
          return;
        }
        if (new Date(d.expires_at).getTime() < Date.now()) {
          router.replace("/auth?expired=1");
          return;
        }
        setLoading(false);
      });
  }, [router]);

  // 本地记忆：刷新不丢
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved?.cols) && saved.cols.length) setCols(saved.cols);
      if (saved?.fixedAmount) setFixedAmount(String(saved.fixedAmount));
    } catch {
      /* 忽略损坏的本地缓存 */
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cols, fixedAmount }));
    } catch {
      /* 忽略写入失败 */
    }
  }, [cols, fixedAmount, loading]);

  const updateCol = (id: string, key: keyof ScoreCol, value: string) => {
    setCols((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const addCol = () => {
    const last = cols[cols.length - 1];
    const nextScore = last ? String(parseFloat(last.score || "0") + 1) : "15";
    setCols((prev) => [...prev, { id: `s${Date.now()}`, score: nextScore, odds: "" }]);
  };

  const removeCol = (id: string) => {
    setCols((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
  };

  const resetAll = () => {
    setCols(defaultCols);
    setFixedAmount(DEFAULT_AMOUNT);
  };

  // 口径：金额固定，注数 = 金额 ÷ 赔率
  const amountN = parseFloat(fixedAmount);
  const amountValid = Number.isFinite(amountN) && amountN > 0;

  const rows = cols.map((c) => {
    const odds = parseFloat(c.odds);
    const valid = Number.isFinite(odds) && odds > 0;
    return {
      ...c,
      hasOdds: valid,
      betN: valid && amountValid ? amountN / odds : NaN,
    };
  });

  const totalBet = rows.reduce((s, r) => s + (r.hasOdds ? r.betN : 0), 0);
  // 差额 = 固定金额 - 合计注数（即中一注后的净利），占比 = 差额 ÷ 合计注数
  const diff = amountValid ? amountN - totalBet : NaN;
  const diffPct = Number.isFinite(diff) && totalBet > 0 ? (diff / totalBet) * 100 : NaN;

  return (
    <div className="app-container page-with-nav">
      <header className="app-header">
        <h1>📊 比分表</h1>
        <p>比分 · 赔率 · 注数 · 金额（金额固定，注数 = 金额 ÷ 赔率）</p>
      </header>

      {!loading && (
        <>
          <div className="card">
            <div className="card-title">🎯 固定金额</div>
            <div className="score-fixed-row">
              <label htmlFor="fixedAmount">总金额</label>
              <input
                id="fixedAmount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value)}
              />
              <button className="btn btn-outline" onClick={resetAll}>
                恢复默认
              </button>
            </div>
            <p className="score-note">
              金额固定不变，改任意一列赔率，注数自动按 <b>注数 = 金额 ÷ 赔率</b> 重算；
              没填赔率的列不参与合计。
            </p>
          </div>

          <div className="card">
            <div className="card-title">🧾 比分赔率表</div>
            <div className="score-scroll">
              <table className="score-table">
                <tbody>
                  {/* 比分（表头） */}
                  <tr>
                    <th className="score-corner">比分</th>
                    {rows.map((r) => (
                      <th key={r.id} className="score-th">
                        <input
                          className="score-cell-input"
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          value={r.score}
                          onChange={(e) => updateCol(r.id, "score", e.target.value)}
                        />
                        <button
                          className="score-del"
                          onClick={() => removeCol(r.id)}
                          title="删除该列"
                        >
                          ×
                        </button>
                      </th>
                    ))}
                    <th className="score-th-add">
                      <button className="score-add" onClick={addCol} title="添加一列">
                        +
                      </button>
                    </th>
                  </tr>

                  {/* 赔率 */}
                  <tr>
                    <th className="score-corner">赔率</th>
                    {rows.map((r) => (
                      <td key={r.id}>
                        <input
                          className="score-cell-input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={r.odds}
                          onChange={(e) => updateCol(r.id, "odds", e.target.value)}
                        />
                      </td>
                    ))}
                    <td />
                  </tr>

                  {/* 注数（自动 = 金额 ÷ 赔率） */}
                  <tr>
                    <th className="score-corner">注数</th>
                    {rows.map((r) => (
                      <td key={r.id} className="score-cell-static">
                        {trimNum(r.betN, 4)}
                      </td>
                    ))}
                    <td />
                  </tr>

                  {/* 金额（固定，所有列一致） */}
                  <tr className="score-row-amount">
                    <th className="score-corner">金额</th>
                    {rows.map((r) => (
                      <td key={r.id}>{amountValid ? trimNum(amountN, 2) : "-"}</td>
                    ))}
                    <td />
                  </tr>

                  {/* 合计 */}
                  <tr className="score-row-total">
                    <th className="score-corner">合计</th>
                    <td colSpan={rows.length + 1}>
                      注数 {trimNum(totalBet, 4)} 注 · 差额{" "}
                      {Number.isFinite(diff) ? trimNum(diff, 2) : "-"}（
                      {Number.isFinite(diffPct) ? trimNum(diffPct, 2) : "-"}%）
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <BottomNav active="score" />
    </div>
  );
}
