#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
weekly_review.py — 自动生成周复盘报表

用法:
    python weekly_review.py                   # 默认上周一到周日
    python weekly_review.py --week 2026-09-08 # 指定周一
    python weekly_review.py --save            # 同时写归档文件

逻辑:
1. 汇总 7 天 daily-metrics → 流量/销售/产品 数字 + 环比
2. 读取 content-log.csv → 逐篇内容归因
3. 读取 experiment-log.csv → 验证选题假设
4. 输出 Markdown 报表 + 决策建议（最多 3 条占位）
"""

import argparse
import csv
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
METRICS = ROOT / "data" / "daily-metrics"
CONTENT_LOG = ROOT / "data" / "content-log.csv"
EXP_LOG = ROOT / "data" / "experiment-log.csv"


def parse_date(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d")


def load_metrics(start: datetime, end: datetime) -> list:
    rows = []
    for d in (start + timedelta(n) for n in range(7)):
        f = METRICS / f"{d.strftime('%Y-%m-%d')}.csv"
        if f.exists():
            with open(f, encoding="utf-8-sig") as fh:
                for r in csv.DictReader(fh):
                    if r.get("date") and any(v for k, v in r.items() if k != "date"):
                        rows.append(r)
    return rows


def sum_field(rows, field):
    return sum(int(float(r.get(field) or 0)) for r in rows)


def load_csv(path: Path) -> list:
    if not path.exists():
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def in_week(row_date: str, start: datetime, end: datetime) -> bool:
    try:
        d = parse_date(row_date)
        return start <= d <= end
    except Exception:
        return False


def main():
    parser = argparse.ArgumentParser(description="周复盘报表")
    parser.add_argument("--week", help="本周一开始日期 YYYY-MM-DD")
    parser.add_argument("--save", action="store_true", help="写入 archive")
    args = parser.parse_args()

    today = datetime.now()
    if args.week:
        start = parse_date(args.week)
    else:
        start = today - timedelta(days=today.weekday() + 7)  # 上周一
    end = start + timedelta(days=6)

    metrics = load_metrics(start, end)
    contents = [r for r in load_csv(CONTENT_LOG) if in_week(r.get("date", ""), start, end)]
    exps = [r for r in load_csv(EXP_LOG) if in_week(r.get("date", ""), start, end)]

    report = []
    report.append(f"# 周复盘 · {start.strftime('%Y-W%V')}（{start:%m/%d} - {end:%m/%d}）\n")

    report.append("## 一、本周数字")
    report.append("| 维度 | 本周 | 备注 |")
    report.append("|---|---|---|")
    report.append(f"| 阅读 | {sum_field(metrics, 'reads')} | |")
    report.append(f"| 分享 | {sum_field(metrics, 'shares')} | |")
    report.append(f"| 新增关注 | {sum_field(metrics, 'new_followers')} | |")
    report.append(f"| 线索 | {sum_field(metrics, 'leads')} | |")
    report.append(f"| 有效沟通 | {sum_field(metrics, 'valid_talks')} | |")
    report.append(f"| 成交 | {sum_field(metrics, 'deals')} | |")
    report.append(f"| GMV | {sum_field(metrics, 'gmv')} | |")
    report.append(f"| 交付 | {sum_field(metrics, 'delivered')} | |")
    report.append(f"| NPS | {sum_field(metrics, 'nps') or '-'} | |")
    report.append("")

    report.append("## 二、内容归因")
    report.append("| 选题 | 阅读 | CTA点击 | 加微 | 成交 | 结论 |")
    report.append("|---|---|---|---|---|---|")
    for c in contents:
        report.append(f"| {c.get('title','')} | {c.get('reads','')} | {c.get('cta_clicks','')} "
                      f"| {c.get('leads','')} | - | 待填 |")
    report.append("")

    report.append("## 三、假设验证")
    for e in exps:
        mark = {"假设": "⏳", "验证有效": "✅", "验证无效": "❌"}.get(e.get("status", ""), "⏳")
        report.append(f"- {mark} [{e.get('type','')}] {e.get('hypothesis','')} → {e.get('result','')}")
    report.append("")

    report.append("## 四、淘汰清单\n- 待填\n")
    report.append("## 五、下周决策（最多 3 条）\n1. 加码 [x]，预期 [指标] 提升 [y]\n2. \n3. \n")
    report.append("## 六、阻塞/求助\n- 待填\n")

    text = "\n".join(report)
    print(text)

    if args.save:
        out = ROOT / "archive" / start.strftime("%Y-%m") / f"weekly-{start:%Y-%m-%d}.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"\n[saved] {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
