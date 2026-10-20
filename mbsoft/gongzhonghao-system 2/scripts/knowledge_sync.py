#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
knowledge_sync.py — 知识库同步：去重、重建索引、校验原子格式

用法:
    python knowledge_sync.py            # 校验 + 去重 + 更新索引
    python knowledge_sync.py --check    # 仅校验格式，不写文件

设计:
- 只追加不覆盖，符合 gzo-archive 的沉淀原则。
- 原子格式: [类型] 一句话描述 / 来源 / 适用条件 / 反例边界
- 重建 knowledge/_index.md（RAG 友好）
"""

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KNOW = ROOT / "knowledge"

ATOMIC_PATTERN = re.compile(r"^\[(\w+)\]\s*(.+)$")  # [类型] 描述


def collect_atoms():
    """遍历 knowledge/*.md，提取符合原子格式的行。"""
    atoms = []
    for md in KNOW.glob("*.md"):
        if md.name.startswith("_"):
            continue
        for i, line in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if line.startswith("- ") or line.startswith("* "):
                line = line[2:]
            m = ATOMIC_PATTERN.match(line)
            if m:
                text = m.group(2).strip()
                # 跳过模板占位符（如 X → Y、...、待填等）
                if not text or set(text.replace("→", "").replace(">", "").strip()) <= set("-.XZY0123456789[](),"):
                    continue
                atoms.append({"file": md.name, "line": i, "type": m.group(1), "text": text})
    return atoms


def check(atoms):
    errors = []
    seen = set()
    for a in atoms:
        key = (a["file"], a["text"])
        if key in seen:
            errors.append(f"[重复] {a['file']}:{a['line']} {a['text']}")
        seen.add(key)
        if len(a["text"]) < 10:
            errors.append(f"[过短] {a['file']}:{a['line']}")
    return errors


def build_index(atoms):
    by_type = {}
    for a in atoms:
        by_type.setdefault(a["type"], []).append(a)
    lines = ["# 知识库索引 · Knowledge Index (RAG Friendly)", ""]
    lines.append(f"> 自动生成，共 {len(atoms)} 个知识原子。请勿手工编辑，改由 knowledge_sync.py 重建。\n")
    for typ, items in sorted(by_type.items()):
        lines.append(f"## {typ}（{len(items)}）")
        for a in items:
            lines.append(f"- `{a['file']}:{a['line']}` {a['text']}")
        lines.append("")
    (KNOW / "_index.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="知识库同步/去重/索引")
    parser.add_argument("--check", action="store_true", help="仅校验，不写文件")
    args = parser.parse_args()

    atoms = collect_atoms()
    errors = check(atoms)

    # 标记模板占位行（避免占位符污染索引）
    for a in atoms:
        if any(tok in a["text"] for tok in ["[指标A]", "[指标B]", "[X]", "[Y]", "..."]) or len(a["text"]) < 8:
            errors.append(f"[占位/过短] {a['file']}:{a['line']} {a['text']}")
    print(f"[scan] 发现 {len(atoms)} 个知识原子")
    if errors:
        print(f"[errors] {len(errors)} 个问题:")
        for e in errors:
            print(f"  {e}")
    else:
        print("[ok] 无重复/格式问题")

    if not args.check:
        build_index(atoms)
        print(f"[index] 已更新 {KNOW / '_index.md'}")


if __name__ == "__main__":
    main()
