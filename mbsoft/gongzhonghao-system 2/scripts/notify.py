#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
notify.py — 多渠道通知（企业微信 / 飞书 / 邮件 / 打印降级）

用法:
    python notify.py "标题" "正文 Markdown"
    python notify.py --daily    # 发送今日日报摘要（读取 archive/今日文件）
    python notify.py --weekly   # 发送周复盘摘要

优先级: 企微 webhook > 飞书 > 邮件 > 打印
配置: .env 中 WECOM_WEBHOOK / LARK_WEBHOOK / SMTP_*
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_config():
    config = {}
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                config[k.strip()] = v.strip()
    return config


def post_webhook(url: str, payload: dict):
    import urllib.request
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, timeout=10,
    )
    urllib.request.urlopen(req)


def send(title: str, body: str, config: dict):
    msg = f"**{title}**\n{body}"
    wecom = config.get("WECOM_WEBHOOK")
    if wecom:
        try:
            post_webhook(wecom, {"msgtype": "markdown", "markdown": {"content": msg}})
            print("[notify] 企微 ✅")
            return
        except Exception as e:
            print(f"[notify] 企微失败: {e}")

    lark = config.get("LARK_WEBHOOK")
    if lark:
        try:
            post_webhook(lark, {"msgtype": "interactive", "card": {"markdown": {"content": msg}}})
            print("[notify] 飞书 ✅")
            return
        except Exception as e:
            print(f"[notify] 飞书失败: {e}")

    smtp_host = config.get("SMTP_HOST")
    if smtp_host:
        # TODO: 接入 smtplib 发送邮件
        print("[notify] 邮件（TODO: 完善 smtplib）")
        return

    print(f"[notify] {msg}")


def read_summary(path: Path) -> str:
    if not path.exists():
        return "（暂无数据）"
    text = path.read_text(encoding="utf-8")
    return "\n".join(text.splitlines()[:30])  # 摘要前 30 行


def main():
    parser = argparse.ArgumentParser(description="通知")
    parser.add_argument("title", nargs="?", help="标题")
    parser.add_argument("body", nargs="?", help="正文")
    parser.add_argument("--daily", action="store_true")
    parser.add_argument("--weekly", action="store_true")
    args = parser.parse_args()

    config = load_config()
    today = datetime.now().strftime("%Y-%m-%d")

    if args.daily:
        path = ROOT / "archive" / today[:7] / f"daily-{today}.md"
        send(f"公众号日报 {today}", read_summary(path), config)
    elif args.weekly:
        # 找本周复盘文件
        path = ROOT / "archive" / today[:7]
        files = list(path.glob("weekly-*.md")) if path.exists() else []
        latest = max(files, key=lambda p: p.stat().st_mtime) if files else Path("/none")
        send("周复盘", read_summary(latest), config)
    elif args.title:
        send(args.title, args.body or "", config)
    else:
        parser.error("需提供 title/body 或 --daily/--weekly")


if __name__ == "__main__":
    main()
