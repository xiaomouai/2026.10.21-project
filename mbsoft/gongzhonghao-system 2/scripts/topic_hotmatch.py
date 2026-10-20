#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
topic_hotmatch.py —— 热点 × 选题原子 匹配器
============================================
流程第 1 步「选题」的核心：
  1. 采集热点（来源可插拔：微信热榜 / 知乎 / 微博 / 行业公众号，默认用内置示例）
  2. 与 knowledge/topic-atoms.md 的选题原子做关键词匹配打分
  3. 输出今日推荐选题 + 命中依据，写入 data/topic-candidates.csv

设计原则（对齐 dbskill 知识原子思想）：
  - 不追纯流量热点，只选「热点势能 × 业务相关度」双高项
  - 每个选题必须能挂上至少一个已验证原子（可复用、可证伪）

用法:
  python topic_hotmatch.py                 # 用内置示例热点跑（离线可用）
  python topic_hotmatch.py --hot-file x.csv  # 接入真实热点 CSV（title,heat 两列）
"""
import os
import re
import csv
import argparse
from datetime import date

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND_FILE = os.path.join(BASE, "data", "topic-candidates.csv")

# ---------- 1. 热点来源（可插拔，此处为离线示例，接入时替换 TODO）----------
def fetch_hot(args):
    """采集热点。TODO: 替换为真实采集（requests + 公众号/热榜 API）。"""
    if args.hot_file and os.path.exists(args.hot_file):
        with open(args.hot_file, encoding="utf-8") as f:
            return list(csv.DictReader(f))
    # 离线示例：模拟当日热榜（接入真实后删掉这段）
    return [
        {"title": "GPT-6 发布，企业级 Agent 正式进入主流视野", "heat": 95, "source": "微信热榜"},
        {"title": "央行降息，中小企业数字化投入意愿回升", "heat": 72, "source": "行业公众号"},
        {"title": "某大厂裁掉 30% 客服团队，改用 AI 智能体", "heat": 88, "source": "知乎热榜"},
        {"title": "RAG 检索增强生成：让大模型读懂企业私有数据", "heat": 65, "source": "技术公众号"},
        {"title": "明星离婚冲上热搜", "heat": 99, "source": "微博"},  # 高势能但业务无关
        {"title": "私域流量回暖：内容获客 ROI 重新被验证", "heat": 70, "source": "营销公众号"},
        {"title": "大模型价格战再起，token 成本降至冰点", "heat": 82, "source": "AI 公众号"},
        {"title": "企业 AI 落地失败率高达 70%，问题出在哪", "heat": 78, "source": "行业公众号"},
    ]

# ---------- 2. 选题原子（从 knowledge 提炼，业务相关度词典）----------
# (题材关键词, 痛点关键词, 角度权重加成, 命中后选题模板)
ATOMS = [
    (["agent", "智能体", "ai 智能体", "ai智能体"], ["落地", "失败", "踩坑", "怎么做"], "避坑", 1.2),
    (["客服", "知识库", "rag", "私有数据"], ["降本", "人力", "替代", "效率"], "案例", 1.15),
    (["大模型", "token", "成本", "价格战"], ["成本", "贵", "投入"], "反常识", 1.1),
    (["企业", "中小企业", "数字化"], ["不知道从哪开始", "怎么开始", "第一步"], "清单", 1.05),
    (["内容获客", "私域", "流量", "线索"], ["获客难", "roi"], "案例", 1.15),
    (["流程", "自动化", "rpa"], ["效率低", "慢"], "拆解", 1.0),
]

BUSINESS_KEYWORDS = ["ai", "智能体", "agent", "大模型", "rag", "知识库", "客服", "自动化",
                     "企业", "数字化", "获客", "私域", "流程", "智能", "降本"]

def relevance(text):
    """业务相关度 0~1：命中越多业务关键词越高。"""
    t = text.lower()
    hit = sum(1 for k in BUSINESS_KEYWORDS if k in t)
    return min(hit / 3, 1.0)

def match_topic(hot):
    """对一个热点打分，返回候选选题列表。"""
    t = hot["title"].lower()
    cands = []
    for topic_kw, pain_kw, angle, boost in ATOMS:
        topic_hit = any(k in t for k in topic_kw)
        pain_hit = [p for p in pain_kw if p in t]
        if not topic_hit:
            continue
        # 选题模板：用热点词 + 原子角度拼装
        root = next(k for k in topic_kw if k in t) if any(k in t for k in topic_kw) else topic_kw[0]
        templates = {
            "避坑": f"「{hot['title'][:12]}」爆火背后：企业落地前必避的 3 个坑",
            "案例": f"从「{hot['title'][:12]}」看：一套可复制的 AI 提效路径",
            "反常识": f"「{hot['title'][:12]}」降温后，企业真正该投的是这 1 件事",
            "清单": f"跟「{hot['title'][:12]}」学：上线前必查的清单",
            "拆解": f"「{hot['title'][:12]}」拆解：从 0 到 1 怎么搭",
        }
        rel = relevance(hot["title"]) or 0.4
        score = round(rel * 0.5 + int(hot["heat"]) / 100 * 0.5, 3) * boost
        cands.append({
            "topic": root, "angle": angle, "pain_hit": "+".join(pain_hit) or "通用",
            "title": templates[angle], "heat": hot["heat"], "relevance": rel,
            "score": score, "source": hot["source"],
        })
    return cands

# ---------- 3. 主流程 ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hot-file", help="真实热点 CSV（title,heat,source）")
    ap.add_argument("--top", type=int, default=3, help="输出前 N 个选题")
    args = ap.parse_args()

    hots = fetch_hot(args)
    all_cands = []
    for h in hots:
        all_cands += match_topic(h)
    all_cands.sort(key=lambda x: x["score"], reverse=True)
    top = all_cands[:args.top]

    print("\n" + "=" * 66)
    print(f"📅 {date.today()}  热点 × 选题原子 匹配结果（Top {args.top}）")
    print("=" * 66)
    for i, c in enumerate(top, 1):
        print(f"\n#{i} 选题：{c['title']}")
        print(f"    题材={c['topic']}  角度={c['angle']}  痛点={c['pain_hit']}")
        print(f"    来源={c['source']}  热度={c['heat']}  业务相关度={c['relevance']}  综合分={c['score']}")

    # 落盘（追加，保留历史，只追加不覆盖）
    fields = ["date", "title", "topic", "angle", "pain_hit", "heat", "relevance", "score", "source"]
    new_file = not os.path.exists(CAND_FILE)
    with open(CAND_FILE, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        if new_file:
            w.writeheader()
        for c in top:
            w.writerow({"date": date.today(), **c})
    print(f"\n✅ 已写入 {CAND_FILE}（追加 {len(top)} 条）")
    return top

if __name__ == "__main__":
    main()
