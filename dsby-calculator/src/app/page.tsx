"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

interface CalcParams {
  aOdds: string;
  bOdds: string;
  aRatio: string;
  bRatio: string;
  aRebate: string;
  bRebate: string;
  fixedSide: "A" | "B";
  fixedAmount: string;
  roundMode: "0" | "1" | "10" | "100" | "1000";
  fixedSideInteger: boolean;
}

interface CalcResult {
  aBet: number;
  bBet: number;
  aEffective: number;
  bEffective: number;
  aRebateAmount: number;
  bRebateAmount: number;
  totalRebate: number;
  baseProfitA: number;
  baseProfitB: number;
  profitA: number;
  profitB: number;
  totalBet: number;
}

const defaultParams: CalcParams = {
  aOdds: "0.92",
  bOdds: "-0.9",
  aRatio: "1",
  bRatio: "1",
  aRebate: "0",
  bRebate: "0",
  fixedSide: "A",
  fixedAmount: "10000",
  roundMode: "1",
  fixedSideInteger: true,
};

const fmt = (n: number) =>
  n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HomePage() {
  const router = useRouter();
  const [params, setParams] = useState<CalcParams>(defaultParams);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [me, setMe] = useState<{
    username: string;
    expires_at: string;
    status: string;
  } | null>(null);

  // 二次校验：登录态 + 账号有效期
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
        setMe(d);
      });
  }, [router]);

  const updateParam = useCallback(
    (key: keyof CalcParams, value: string | boolean) => {
      setParams((prev) => ({ ...prev, [key]: value }) as CalcParams);
    },
    []
  );

  const calculate = useCallback(() => {
    const oA = parseFloat(params.aOdds) || 0;
    const oB = parseFloat(params.bOdds) || 0;
    // 平衡公式用 1+|赔率|（正负赔率都成立）
    const wA = Math.abs(oA);
    const wB = Math.abs(oB);
    // 马来赔率规则：正赔率赢=赔率、输=1；负赔率赢=1、输=|赔率|
    const winA = oA >= 0 ? oA : 1;
    const loseA = oA >= 0 ? 1 : wA;
    const winB = oB >= 0 ? oB : 1;
    const loseB = oB >= 0 ? 1 : wB;
    const rA = parseFloat(params.aRatio) || 1;
    const rB = parseFloat(params.bRatio) || 1;
    const rbA = parseFloat(params.aRebate) || 0;
    const rbB = parseFloat(params.bRebate) || 0;
    let fixedAmount = parseFloat(params.fixedAmount) || 0;
    if (params.fixedSideInteger) fixedAmount = Math.round(fixedAmount);

    // 平衡公式（占成参与）：
    //   有效额 aEff = aBet * rA，bEff = bBet * rB
    //   平衡条件 aEff*(1+wA) = bEff*(1+wB)  =>  两边利润相等
    // 若A赢利润 = aEff*winA - bEff*loseB + 回水；若B赢 = bEff*winB - aEff*loseA + 回水
    let aBet: number, bBet: number;
    if (params.fixedSide === "A") {
      aBet = fixedAmount;
      const aEff = aBet * rA;
      const bEff = (aEff * (1 + wA)) / (1 + wB);
      bBet = bEff / rB;
    } else {
      bBet = fixedAmount;
      const bEff = bBet * rB;
      const aEff = (bEff * (1 + wB)) / (1 + wA);
      aBet = aEff / rA;
    }

    // 只对"非固定边"四舍五入（dsby.org: 非固定边四舍五入）
    // roundMode: "0"=不取整, "1"=个位, "10"=十位, "100"=百位, "1000"=千位
    const roundUnit = parseFloat(params.roundMode) || 0;
    if (roundUnit > 0) {
      if (params.fixedSide === "A") {
        bBet = Math.round(bBet / roundUnit) * roundUnit;
      } else {
        aBet = Math.round(aBet / roundUnit) * roundUnit;
      }
    }

    const aEffective = aBet * rA;
    const bEffective = bBet * rB;

    // 回水以「小数」输入：0.025 即 2.5%，直接乘投注额（不再 /100）
    const aRebateAmount = aBet * rbA;
    const bRebateAmount = bBet * rbB;
    const totalRebate = aRebateAmount + bRebateAmount;

    // 基础套利利润（去回水）：占成已体现在有效额；负赔率按 win=1/lose=|w| 处理
    const baseProfitA = aEffective * winA - bEffective * loseB;
    const baseProfitB = bEffective * winB - aEffective * loseA;

    // 最终利润 = 基础套利利润 + 总回水（回水以「总回水」形式同时、等量加到两边）
    const profitA = baseProfitA + totalRebate;
    const profitB = baseProfitB + totalRebate;

    setResult({
      aBet,
      bBet,
      aEffective,
      bEffective,
      aRebateAmount,
      bRebateAmount,
      totalRebate,
      baseProfitA,
      baseProfitB,
      profitA,
      profitB,
      totalBet: aBet + bBet,
    });
  }, [params]);

  const reset = useCallback(() => {
    setParams(defaultParams);
    setResult(null);
  }, []);

  return (
    <div className="app-container page-with-nav">
      <header className="app-header">
        <h1>💧 打水计算器</h1>
        <p>双边套利 · 精确计算 · 稳赚不赔</p>
      </header>

      {me && (
        <div className="user-banner">
          <span>
            👤 {me.username} · 到期{" "}
            {new Date(me.expires_at).toLocaleDateString("zh-CN")}
          </span>
          <button
            className="user-banner-logout"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/auth");
              router.refresh();
            }}
          >
            退出
          </button>
        </div>
      )}

      {/* Card 1: 网站 A VS 网站 B */}
      <div className="card">
        <div className="card-title">网站 A VS 网站 B</div>
        <div className="vs-grid">
          <div className="vs-col">
            <Field label="A 赔率" value={params.aOdds} onChange={(v) => updateParam("aOdds", v)} step="0.01" />
            <Field label="A 占成" value={params.aRatio} onChange={(v) => updateParam("aRatio", v)} step="0.01" />
            <Field label="A 回水" value={params.aRebate} onChange={(v) => updateParam("aRebate", v)} step="0.001" />
          </div>
          <div className="vs-col">
            <Field label="B 赔率" value={params.bOdds} onChange={(v) => updateParam("bOdds", v)} step="0.01" />
            <Field label="B 占成" value={params.bRatio} onChange={(v) => updateParam("bRatio", v)} step="0.01" />
            <Field label="B 回水" value={params.bRebate} onChange={(v) => updateParam("bRebate", v)} step="0.001" />
          </div>
        </div>
      </div>

      {/* Card 2: 参数与结果 */}
      <div className="card">
        <div className="card-title">参数与结果</div>

        <div className="param-row">
          <div className="param-field">
            <label>固定边</label>
            <select
              value={params.fixedSide}
              onChange={(e) => updateParam("fixedSide", e.target.value as "A" | "B")}
            >
              <option value="A">固定 A 网</option>
              <option value="B">固定 B 网</option>
            </select>
          </div>
          <div className="param-field">
            <label>固定金额</label>
            <input
              type="number"
              value={params.fixedAmount}
              onChange={(e) => updateParam("fixedAmount", e.target.value)}
            />
          </div>
        </div>

        <div className="param-row">
          <div className="param-field">
            <label>非固定边四舍五入</label>
            <select
              value={params.roundMode}
              onChange={(e) => updateParam("roundMode", e.target.value as CalcParams["roundMode"])}
            >
              <option value="0">不取整</option>
              <option value="1">个位</option>
              <option value="10">十位</option>
              <option value="100">百位</option>
              <option value="1000">千位</option>
            </select>
          </div>
          <div className="param-field param-checkbox">
            <label>
              <input
                type="checkbox"
                checked={params.fixedSideInteger}
                onChange={(e) => updateParam("fixedSideInteger", e.target.checked)}
              />
              固定边整数
            </label>
          </div>
        </div>

        <div className="btn-group-inline">
          <button className="btn btn-primary" onClick={calculate}>计算</button>
          <button className="btn btn-outline" onClick={reset}>重置</button>
        </div>

        {result && (
          <div className="result-section">
            <div className="result-grid">
              <div className="result-col">
                <ResultLine label="A 投注额" value={result.aBet} />
                <ResultLine label="A 有效额" value={result.aEffective} />
                <ResultLine label="A 回水" value={result.aRebateAmount} />
              </div>
              <div className="result-col">
                <ResultLine label="B 投注额" value={result.bBet} />
                <ResultLine label="B 有效额" value={result.bEffective} />
                <ResultLine label="B 回水" value={result.bRebateAmount} />
              </div>
            </div>
            <div className="result-profit-row">
              <span>若 A 赢：</span>
              <strong className={result.profitA >= 0 ? "profit-pos" : "profit-neg"}>
                {result.profitA.toFixed(2)}
              </strong>
              <span className="result-profit-decomp">
                = {result.baseProfitA.toFixed(2)} + 回水 {result.totalRebate.toFixed(2)}
              </span>
            </div>
            <div className="result-profit-row">
              <span>若 B 赢：</span>
              <strong className={result.profitB >= 0 ? "profit-pos" : "profit-neg"}>
                {result.profitB.toFixed(2)}
              </strong>
              <span className="result-profit-decomp">
                = {result.baseProfitB.toFixed(2)} + 回水 {result.totalRebate.toFixed(2)}
              </span>
            </div>
            <div className="result-total">
              合计下达：{fmt(result.totalBet)}
            </div>
          </div>
        )}
      </div>

      <BottomNav active="calc" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="form-row-inline">
      <label>{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ResultLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="result-line">
      <span>{label}：</span>
      <span>{fmt(value)}</span>
    </div>
  );
}
