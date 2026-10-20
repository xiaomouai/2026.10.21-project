#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish_queue.py — 发布队列管理：定档、状态流转、重试、登记 content-log

用法:
    python publish_queue.py add <title> --time "2026-09-15 20:30" --stage 流量 --topic <id>
    python publish_queue.py list
    python publish_queue.py publish <id>      # 执行发布（调用真实 API 处在此 TODO）
    python publish_queue.py status <id> <状态>

队列文件: scripts/.publish_queue.csv（运行时自动创建）
content-log 登记: data/content-log.csv（发布成功后追加）

状态机: 草稿 → 已定档 → 已发布 / 失败
失败时自动重试最多 3 次，仍失败转人工并告警。
"""

import argparse
import csv
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "scripts" / ".publish_queue.csv"
CONTENT_LOG = ROOT / "data" / "content-log.csv"

QUEUE_FIELDS = ["id", "date", "time", "title", "topic_id", "funnel_stage",
                "channels", "status", "attempts", "notes"]
CONTENT_LOG_FIELDS = ["date", "title", "topic_id", "funnel_stage", "channels",
                      "status", "reads", "cta_clicks", "leads", "notes"]

MAX_RETRY = 3


def ensure_files():
    QUEUE.parent.mkdir(exist_ok=True)
    if not QUEUE.exists():
        with open(QUEUE, "w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f).writerow(QUEUE_FIELDS)
    if not CONTENT_LOG.exists():
        ROOT.joinpath("data").mkdir(exist_ok=True)
        with open(CONTENT_LOG, "w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f).writerow(CONTENT_LOG_FIELDS)


def next_id() -> int:
    with open(QUEUE, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    return (max([int(r["id"]) for r in rows if r.get("id")], default=0)) + 1


def load_queue() -> list:
    with open(QUEUE, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def save_queue(rows: list):
    with open(QUEUE, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=QUEUE_FIELDS)
        w.writeheader()
        w.writerows(rows)


def cmd_add(args):
    ensure_files()
    rid = next_id()
    row = {k: "" for k in QUEUE_FIELDS}
    row.update({
        "id": rid,
        "date": args.time.split(" ")[0],
        "time": args.time,
        "title": args.title,
        "topic_id": args.topic or "",
        "funnel_stage": args.stage or "流量",
        "channels": args.channels or "公众号",
        "status": "已定档",
        "attempts": 0,
        "notes": "",
    })
    rows = load_queue()
    rows.append(row)
    save_queue(rows)
    print(f"[queued] #{rid} {args.title} @ {args.time}")


def cmd_list(_):
    ensure_files()
    rows = load_queue()
    if not rows:
        print("[empty] 队列为空")
        return
    print(f"{'ID':<4} {'时间':<17} {'状态':<8} {'标题'}")
    for r in rows:
        print(f"{r['id']:<4} {r['time']:<17} {r['status']:<8} {r['title']}")


def do_publish(row: dict) -> bool:
    """
    真实发布逻辑。TODO: 接入公众号 API / 排版工具。
    当前为骨架：模拟发布，成功则 status=已发布。
    """
    # TODO: 调用真实发布 API，例如 wechat_api.publish(row["title"], content)
    print(f"[publish] 模拟发布 #{row['id']}: {row['title']}")
    return True


def cmd_publish(args):
    ensure_files()
    rows = load_queue()
    target = [r for r in rows if int(r["id"]) == args.id]
    if not target:
        print(f"[error] 未找到 #{args.id}")
        return
    row = target[0]

    for attempt in range(1, MAX_RETRY + 1):
        row["attempts"] = attempt
        if do_publish(row):
            row["status"] = "已发布"
            save_queue(rows)
            append_content_log(row)
            print(f"[success] #{row['id']} 已发布")
            return
        print(f"[retry] 第 {attempt} 次失败")
        time.sleep(2)

    row["status"] = "失败"
    save_queue(rows)
    print(f"[fail] #{row['id']} 重试 {MAX_RETRY} 次后仍失败，转人工")
    # TODO: 触发告警 notify.py


def append_content_log(row: dict):
    """发布成功后登记 content-log.csv。"""
    with open(CONTENT_LOG, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=CONTENT_LOG_FIELDS)
        w.writerow({
            "date": row["date"],
            "title": row["title"],
            "topic_id": row["topic_id"],
            "funnel_stage": row["funnel_stage"],
            "channels": row["channels"],
            "status": "已发布",
            "reads": "",
            "cta_clicks": "",
            "leads": "",
            "notes": "",
        })


def cmd_status(args):
    ensure_files()
    rows = load_queue()
    for r in rows:
        if int(r["id"]) == args.id:
            r["status"] = args.status
    save_queue(rows)
    print(f"[updated] #{args.id} → {args.status}")


def main():
    parser = argparse.ArgumentParser(description="发布队列管理")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="添加发布任务")
    p_add.add_argument("title")
    p_add.add_argument("--time", required=True, help="发布时间 'YYYY-MM-DD HH:MM'")
    p_add.add_argument("--topic", help="选题 ID")
    p_add.add_argument("--stage", help="服务环节: 流量/信任/销售/产品")
    p_add.add_argument("--channels", help="分发渠道，逗号分隔")
    p_add.set_defaults(func=cmd_add)

    sub.add_parser("list", help="查看队列").set_defaults(func=cmd_list)

    p_pub = sub.add_parser("publish", help="执行发布")
    p_pub.add_argument("id", type=int)
    p_pub.set_defaults(func=cmd_publish)

    p_st = sub.add_parser("status", help="更新状态")
    p_st.add_argument("id", type=int)
    p_st.add_argument("status")
    p_st.set_defaults(func=cmd_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
