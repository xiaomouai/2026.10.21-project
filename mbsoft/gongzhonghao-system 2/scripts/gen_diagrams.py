#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_diagrams.py — 生成架构图与闭环图（PNG）
依赖: pip install matplotlib
若未安装，脚本会优雅退出，不影响主流程。
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs"
OUT.mkdir(exist_ok=True)

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
    HAS_MPL = True
except ImportError:
    HAS_MPL = False


def triangle(ax):
    pts = {"流量": (0.5, 0.85), "销售": (0.15, 0.25), "产品": (0.85, 0.25)}
    labels = {
        "流量": "流量\n内容获客 / 投放 / 分发",
        "销售": "销售\n私域承接 / 成交",
        "产品": "产品\n智能体方案 / 交付",
    }
    for name, (x, y) in pts.items():
        box = FancyBboxPatch((x - 0.16, y - 0.08), 0.32, 0.16,
                             boxstyle="round,pad=0.02", fc="#4C9BE8", ec="none")
        ax.add_patch(box)
        ax.text(x, y, labels[name], ha="center", va="center", color="white", fontsize=9)
    # 循环箭头
    arrows = [("流量", "销售", "线索"), ("销售", "产品", "反馈"), ("产品", "流量", "案例")]
    for a, b, label in arrows:
        x1, y1 = pts[a]; x2, y2 = pts[b]
        ar = FancyArrowPatch((x1, y1 - 0.08), (x2, y2 + (0.08 if y2 > y1 else -0.08)),
                             arrowstyle="-|>", mutation_scale=18, color="#E8743B", lw=2)
        ax.add_patch(ar)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis("off")


def architecture(ax):
    layers = [
        ("入口层", ["/gzo 总入口"]),
        ("能力层 (Skills)", ["诊断", "选题", "写作", "发布", "流量", "转化", "产品", "数据", "归档"]),
        ("流程层 (Workflows)", ["日流程", "周复盘", "月战略", "客户搭建"]),
        ("知识层", ["选题原子", "标题公式", "钩子库", "CTA库", "异议库"]),
        ("数据层", ["daily-metrics", "content/experiment/lead/deal-log"]),
    ]
    y = 0.9
    for name, items in layers:
        box = FancyBboxPatch((0.1, y - 0.12), 0.8, 0.14,
                             boxstyle="round,pad=0.01", fc="#5BAE6E", ec="none")
        ax.add_patch(box)
        ax.text(0.5, y - 0.05, f"{name}: " + " · ".join(items),
                ha="center", va="center", color="white", fontsize=8)
        y -= 0.18
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis("off")


def main():
    if not HAS_MPL:
        print("[skip] matplotlib 未安装，跳过图生成（不影响主流程）")
        print("       如需生成: pip install matplotlib")
        return
    for title, fn in [("闭环图", triangle), ("架构图", architecture)]:
        try:
            fig, ax = plt.subplots(figsize=(6, 5))
            fn(ax)
            ax.set_title(title, fontsize=13, fontfamily="WenQuanYi Micro Hei")
            out = OUT / f"{'loop' if title == '闭环图' else 'arch'}.png"
            fig.savefig(out, dpi=150, bbox_inches="tight")
            plt.close(fig)
            print(f"[saved] {out.relative_to(ROOT)}")
        except Exception as e:
            print(f"[warn] {title} 生成失败: {e}")


if __name__ == "__main__":
    main()
