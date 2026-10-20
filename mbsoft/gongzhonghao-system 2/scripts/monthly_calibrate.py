#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monthly_calibrate.py — 月度「流量-销售-产品」三角校准

用法:
    python monthly_calibrate.py                 # 默认上月
    python monthly_calibrate.py --month 2026-09

逻辑:
1. 汇总当月 daily-metrics
2. 计算三段转化率，对照健康基准，标红缺口
3. 判定「最堵环节」→ 输出资源倾斜建议
4. 生成月度战略骨架（配合 workflows/monthly-strategy.md 手工补全）
"""

import argparse
from datetime import datetime
from pathlib import Path

from daily_collect import METRICS_DIR, load_env_config  # reuse helpers
from weekly_review import load_csv, parse_date
import csv

ROOT = Path(__file__).resolve().parent.parent

# 健康基准（来自 workflows/monthly-strategy.md）
BENCHMARK = {
    "reads_to_cta": (3, 8),      # 阅读 → CTA 点击率 %
    "cta_to_add": (30, None),     # CTA 点击 → 加微 %
    "add_to_talk": (50, None),    # 加微 → 有效沟通 %
    "talk_to_deal": (10, 30),     # 有效沟通 → 成交 %
}


def sum_field(rows, field):
    return sum(int(float(r.get(field) or 0)) for r in rows)


def main():
    parser = argparse.ArgumentParser(description="月度三角校准")
    parser.add_argument("--month", help="月份 YYYY-MM，默认上月")
    args = parser.parse_args()

    if args.month:
        ym = args.month
    else:
        today = datetime.now()
        ym = f"{today.year}-{today.month:02d}"

    # 汇总当月指标
    rows = []
    for f in (METRICS_DIR).glob(f"{ym}-*.csv"):
        with open(f, encoding="utf-8-sig") as fh:
            for r in csv.DictReader(fh):
                if r.get("date") and any(v for k, v in r.items() if k != "date"):
                    rows.append(r)

    reads = sum_field(rows, "reads")
    cta = sum_field(rows, "cta_clicks")
    leads = sum_field(rows, "leads")
    talks = sum_field(rows, "valid_talks")
    deals = sum_field(rows, "deals")

    print(f"# 月度校准 · {ym}\n")
    print("## 一、三角健康度\n")

    def rate(num, denom):
        return round(num / denom * 100, 1) if denom else 0

    r_cta = rate(cta, reads)
    r_add = rate(leads, cta)  # 近似：cta_clicks 字段复用，实际应区分
    r_talk = rate(talks, leads)
    r_deal = rate(deals, talks)

    def flag(val, lo, hi):
        if val == 0:
            return "⚠️ 无数据"
        if val < lo:
            return f"🚨 低于基准 {lo}%"
        if hi and val > hi:
            return f"✅ 高于上限 {hi}%"
        return "✅ 健康"

    print(f"- 阅读 → CTA点击率: {r_cta}%  {flag(r_cta, *BENCHMARK['reads_to_cta'])}")
    print(f"- CTA点击 → 加微率: {r_add}%  {flag(r_add, *BENCHMARK['cta_to_add'])}")
    print(f"- 加微 → 有效沟通率: {r_talk}%  {flag(r_talk, *BENCHMARK['add_to_talk'])}")
    print(f"- 有效沟通 → 成交率: {r_deal}%  {flag(r_deal, *BENCHMARK['talk_to_deal'])}")
    print()

    # 判定最堵环节
    print("## 二、最堵环节判定")
    gaps = {
        "流量（阅读→CTA）": (BENCHMARK["reads_to_cta"][0] - r_cta) if r_cta < BENCHMARK["reads_to_cta"][0] else 0,
        "销售（CTA→加微）": (BENCHMARK["cta_to_add"][0] - r_add) if r_add < BENCHMARK["cta_to_add"][0] else 0,
        "销售（加微→沟通）": (BENCHMARK["add_to_talk"][0] - r_talk) if r_talk < BENCHMARK["add_to_talk"][0] else 0,
        "产品/成交（沟通→成交）": (BENCHMARK["talk_to_deal"][0] - r_deal) if r_deal < BENCHMARK["talk_to_deal"][0] else 0,
    }
    gaps = {k: v for k, v in gaps.items() if v > 0}
    if not gaps:
        print("- ✅ 三段均在健康区间，聚焦放大即可。")
        bottleneck = None
    else:
        bottleneck = max(gaps, key=gaps.get)
        print(f"- 最堵环节: **{bottleneck}**（缺口 {gaps[bottleneck]:.1f} 个百分点）")
    print()

    print("## 三、下月资源倾斜建议")
    mapping = {
        "流量": "加码渠道实验 + 选题原子迭代（gzo-traffic, gzo-topic）",
        "销售": "私域承接 SOP + 成交话术 + 异议库（gzo-convert）",
        "产品": "需求优先级 + 定价拆分 + 交付迭代（gzo-product）",
    }
    if bottleneck:
        key = "产品" if "成交" in bottleneck else ("销售" if "沟通" in bottleneck or "加微" in bottleneck else "流量")
        print(f"- 聚焦: {mapping[key]}")
    print()
    print("## 四、关键实验（2-3 个，待补）\n1. 假设: ｜ 变量: ｜ 验收: ｜ 止损线:\n")
    print("> 完整战略文档请配合 workflows/monthly-strategy.md 手工补全。")


if __name__ == "__main__":
    main()
