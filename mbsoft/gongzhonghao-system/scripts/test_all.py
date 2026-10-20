#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""端到端测试：初始化 → 采集 → 发布队列 → 周复盘 → 月校准 → 知识库 → 备份"""
import subprocess, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent

def run(cmd, **kw):
    print(f"\n$ {cmd}")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)
    print(r.stdout)
    if r.returncode != 0 or r.stderr:
        print("STDERR:", r.stderr)
    assert r.returncode == 0, f"FAILED: {cmd}"
    return r

os.chdir(ROOT)

# 1. 初始化
run(f"python {SCRIPTS/'daily_collect.py'} --init")

# 2. 采集（用示例数据日期）
run(f"python {SCRIPTS/'daily_collect.py'} --date 2026-09-13")

# 3. 发布队列
run(f"python {SCRIPTS/'publish_queue.py'} add '测试文章：AI 智能体避坑 3 招' --time '2026-09-15 20:30' --topic 1 --stage 流量 --channels 公众号,知乎")
run(f"python {SCRIPTS/'publish_queue.py'} list")
run(f"python {SCRIPTS/'publish_queue.py'} publish 1")

# 4. 知识库同步
run(f"python {SCRIPTS/'knowledge_sync.py'}")

# 5. 周复盘（指定含示例数据的周）
run(f"python {SCRIPTS/'weekly_review.py'} --week 2026-09-07 --save")

# 6. 月度校准
run(f"python {SCRIPTS/'monthly_calibrate.py'} --month 2026-09")

# 7. 备份
run(f"python {SCRIPTS/'backup_archive.py'}")

print("\n✅ ALL TESTS PASSED")
