#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
daily_collect.py — 每日数据采集 + 日报生成 + 异常标红 + 通知

用法:
    python daily_collect.py --init          # 首次运行，初始化所有 CSV
    python daily_collect.py                 # 采集当日数据（默认今天）
    python daily_collect.py --date 2026-09-14
    python daily_collect.py --notify        # 采集后推送通知

设计原则:
- 只追加，不覆盖历史。
- 脚本只做「采集 + 记录」，决策由 Skill/人做出。
- 数据来源默认从环境变量/配置文件读取，缺失则留空（手工补填）。
"""

import argparse
import csv
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
METRICS_DIR = DATA / "daily-metrics"

# 基准阈值（触发「异常标红」）
THRESHOLDS = {
    "reads": 100,        # 阅读低于此值 → 警告
    "cta_clicks": 3,     # CTA 点击率(%) 低于此值 → 警告
    "conversion_rate": 10,  # 线索→成交率(%) 低于此值 → 警告
}

CSV_FIELDS = [
    "date", "reads", "shares", "new_followers", "ext_clicks",
    "leads", "private_add", "valid_talks", "deals", "gmv",
    "delivered", "nps", "refunds", "new_feedback",
    "published_count", "cta_clicks", "conversion_rate", "notes"
]


def init_csv():
    """初始化所有台账文件（含表头），已存在则跳过。"""
    DATA.mkdir(exist_ok=True)
    METRICS_DIR.mkdir(exist_ok=True)

    files = {
        DATA / "content-log.csv": ["date", "title", "topic_id", "funnel_stage",
                                   "channels", "status", "reads", "cta_clicks", "leads", "notes"],
        DATA / "experiment-log.csv": ["id", "date", "type", "hypothesis", "variable",
                                      "metric", "target", "status", "result", "notes"],
        DATA / "lead-log.csv": ["date", "source", "content_id", "stage", "pain",
                                "budget", "decision_time", "objection", "owner", "notes"],
        DATA / "deal-log.csv": ["date", "lead_id", "product", "amount",
                                "source_content", "source_channel", "rep", "notes"],
    }
    for path, fields in files.items():
        if not path.exists():
            with open(path, "w", newline="", encoding="utf-8-sig") as f:
                csv.writer(f).writerow(fields)
            print(f"[init] created {path.relative_to(ROOT)}")
        else:
            print(f"[init] skip {path.relative_to(ROOT)} (已存在，保留数据)")

    # 今日指标文件
    today = datetime.now().strftime("%Y-%m-%d")
    metric_file = METRICS_DIR / f"{today}.csv"
    if not metric_file.exists():
        with open(metric_file, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(CSV_FIELDS)
        print(f"[init] created {metric_file.relative_to(ROOT)}")
    else:
        print(f"[init] skip {metric_file.relative_to(ROOT)} (已存在，保留数据)")


def load_env_config():
    """从 .env / config.yaml 读取配置（这里做最小实现，缺则留空）。"""
    config = {}
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                config[k.strip()] = v.strip()
    return config


def collect(today: str) -> dict:
    """
    采集当日数据。
    TODO: 在此接入真实数据源（公众号 API、企微后台、CRM、广告平台）。
    当前为「骨架实现」：自动生成空行，供手工补填或后续接入。
    """
    metric_file = METRICS_DIR / f"{today}.csv"
    row = {k: "" for k in CSV_FIELDS}
    row["date"] = today

    # 保留已有数据：若文件已存在且含有效行，则以现有值为准（不覆盖示例/手工填入）
    if metric_file.exists():
        with open(metric_file, encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        if rows and any(v for v in rows[0].values()):
            row.update({k: v for k, v in rows[0].items() if v})
    else:
        with open(metric_file, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(CSV_FIELDS)
            w.writerow([today] + [""] * (len(CSV_FIELDS) - 1))

    # TODO: 接入真实 API，例如:
    #   row["reads"] = wechat_api.get_reads(today)
    #   row["private_add"] = wecom_api.get_new_contacts(today)
    return row


def write_row(row: dict):
    metric_file = METRICS_DIR / f"{row['date']}.csv"
    with open(metric_file, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerow(row)


def detect_anomalies(row: dict) -> list:
    """对照基准阈值，标红异常指标。"""
    alerts = []
    checks = [
        ("reads", "阅读量", "reads"),
        ("cta_clicks", "CTA 点击率(%)", "conversion_rate"),  # 注意：此处用 conversion_rate 字段存 CTR
    ]
    # 阅读量
    try:
        if int(row.get("reads") or 0) < THRESHOLDS["reads"]:
            alerts.append(f"⚠️ 阅读量 {row.get('reads')} < 基准 {THRESHOLDS['reads']}")
    except ValueError:
        pass
    # CTA 点击率（存在且可解析时检查）
    try:
        ctr = float(row.get("cta_clicks") or 0)
        if ctr and ctr < THRESHOLDS["cta_clicks"]:
            alerts.append(f"⚠️ CTA 点击率偏低 ({ctr}%)")
    except ValueError:
        pass
    return alerts


def generate_daily_report(today: str, row: dict, alerts: list) -> str:
    """生成 Markdown 日报，写入 archive/YYYY-MM/。"""
    month_dir = ROOT / "archive" / today[:7]
    month_dir.mkdir(parents=True, exist_ok=True)
    report_path = month_dir / f"daily-{today}.md"

    lines = [
        f"# 日报 · {today}",
        "",
        "## 关键数字",
        f"- 阅读：{row.get('reads', '-')} ｜ 分享：{row.get('shares', '-')} ｜ 新增关注：{row.get('new_followers', '-')}",
        f"- 线索：{row.get('leads', '-')} ｜ 有效沟通：{row.get('valid_talks', '-')} ｜ 成交：{row.get('deals', '-')} ｜ GMV：{row.get('gmv', '-')}",
        f"- 交付：{row.get('delivered', '-')} ｜ NPS：{row.get('nps', '-')} ｜ 退款：{row.get('refunds', '-')}",
        "",
        "## 异常告警" if alerts else "## 异常告警\n_无_",
    ]
    for a in alerts:
        lines.append(f"- {a}")
    lines += [
        "",
        "## 待办（需要人/Skill 决策）",
        "- [ ] 若阅读低 → 触发 gzo-diagnosis",
        "- [ ] 若有线索无成交 → 找 gzo-convert / gzo-product",
        "",
        f"> 数据来源：{row}",
    ]
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return str(report_path.relative_to(ROOT))


def notify(message: str):
    """推送通知。优先级：企微 webhook > 邮件 > 打印。"""
    config = load_env_config()
    webhook = config.get("WECOM_WEBHOOK") or os.getenv("WECOM_WEBHOOK")
    if webhook:
        try:
            import urllib.request, json
            req = urllib.request.Request(
                webhook,
                data=json.dumps({"msgtype": "markdown", "markdown": {"content": message}}).encode(),
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=5)
            print("[notify] 企微推送成功")
            return
        except Exception as e:
            print(f"[notify] 企微失败，降级打印：{e}")
    print(f"[notify] {message}")


def main():
    parser = argparse.ArgumentParser(description="每日数据采集 + 日报")
    parser.add_argument("--init", action="store_true", help="初始化所有 CSV")
    parser.add_argument("--date", help="指定日期 YYYY-MM-DD，默认今天")
    parser.add_argument("--notify", action="store_true", help="采集后推送通知")
    args = parser.parse_args()

    if args.init:
        init_csv()
        print("[done] 初始化完成")
        return

    today = args.date or datetime.now().strftime("%Y-%m-%d")
    print(f"[collect] {today}")

    row = collect(today)
    alerts = detect_anomalies(row)
    write_row(row)
    report = generate_daily_report(today, row, alerts)

    print(f"[report] {report}")
    if alerts:
        print("[alerts]")
        for a in alerts:
            print(f"  {a}")

    if args.notify:
        notify(f"**公众号日报 {today}**\n异常：{len(alerts)} 项\n详见 {report}")

    # 提示手工补填
    if not row.get("reads"):
        print("[tip] 数据为空，请手工补填或接入数据源后重跑。")


if __name__ == "__main__":
    main()
