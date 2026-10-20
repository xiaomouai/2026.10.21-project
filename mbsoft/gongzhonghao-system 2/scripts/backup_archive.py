#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
backup_archive.py — 归档备份（只追加，不覆盖）

用法:
    python backup_archive.py              # 全量打包 archive/ + data/ → backups/时间戳.zip
    python backup_archive.py --sync      # 同步到远程（需配置 .env 中的 RCLONE_REMOTE 等）

原则:
- archive/ 永不删除，只标记 deprecated。
- 更新知识库/SOP 不破坏 archive 与 data 的历史（对齐 dbskill 的更新机制）。
"""

import argparse
import shutil
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive"
DATA = ROOT / "data"
BACKUPS = ROOT / "backups"

def main():
    parser = argparse.ArgumentParser(description="归档备份")
    parser.add_argument("--sync", action="store_true", help="同步到远程存储")
    args = parser.parse_args()

    BACKUPS.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = BACKUPS / f"backup-{stamp}"
    target.mkdir()

    # 复制 archive 与 data（保留历史，不覆盖旧备份）
    if ARCHIVE.exists():
        shutil.copytree(ARCHIVE, target / "archive")
    if DATA.exists():
        shutil.copytree(DATA, target / "data")

    # 打包为 zip
    zip_path = BACKUPS / f"backup-{stamp}.zip"
    shutil.make_archive(str(target), "zip", str(target))
    shutil.rmtree(target)
    print(f"[backup] {zip_path.relative_to(ROOT)}")

    if args.sync:
        remote = None
        env_path = ROOT / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("RCLONE_REMOTE="):
                    remote = line.split("=", 1)[1].strip()
        if remote:
            # TODO: 真实同步命令，需安装 rclone
            print(f"[sync] 待同步到 {remote}（TODO: 安装 rclone 后启用）")
        else:
            print("[sync] 未配置 RCLONE_REMOTE，跳过")


if __name__ == "__main__":
    main()
