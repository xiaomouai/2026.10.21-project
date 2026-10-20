#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_article.py —— 基于选中选题，套 article-template 生成今日文章（步骤2：写作）"""
import os, csv, argparse
from datetime import date

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(BASE, "templates", "article-template.md")
CAND = os.path.join(BASE, "data", "topic-candidates.csv")
OUT_DIR = os.path.join(BASE, "drafts")

def load_top1():
    with open(CAND, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    today = str(date.today())
    rows = [r for r in rows if r["date"] == today]
    return max(rows, key=lambda r: float(r["score"])) if rows else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", help="手动指定标题，否则用今日 Top1")
    args = ap.parse_args()
    cand = load_top1()
    title = args.title or (cand["title"] if cand else "今日选题（默认）")
    os.makedirs(OUT_DIR, exist_ok=True)
    slug = title.replace("「", "").replace("」", "")[:15]
    out = os.path.join(OUT_DIR, f"{date.today()}-{slug}.md")
    content = f"""# {title}

> 选题来源：热点匹配 Top1（{cand['source']}，热度 {cand['heat']}，业务相关度 {cand['relevance']}）
> 题材={cand['topic']} · 角度={cand['angle']} · 痛点={cand['pain_hit']}

## 开篇钩子
{ { "避坑":"别一上来就上大模型。","案例":"先看一个真实路径。","反常识":"降温后才是好时机。","清单":"上线前把这几点想清楚。","拆解":"我们一层层拆开看。" }.get(cand['angle'],"从一个问题开始。") }

## 一、热点背后的真问题
（对应痛点：{cand['pain_hit']}）

## 二、方法论（可复用）
1. 先理流程，再上模型
2. 用真实数据验收，不只看 Demo
3. 小范围试点，跑通再扩

## 三、案例 / 数据支撑
（此处填交付案例，可证伪指标：响应时效、人力节省、转化率）

## 四、行动指引（CTA）
想搭一套属于你业务的 AI 智能体？回复「方案」领取《企业 AI 落地清单》。

---
闭环标签：流量→销售（CTA 收集线索）→ 产品（异议反哺迭代）
"""
    with open(out, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ 文章已生成：{out}")
    print(f"   选题：{title}\n   角度={cand['angle']}  痛点={cand['pain_hit']}")
    # 登记到内容台账
    log = os.path.join(BASE, "data", "content-log.csv")
    new_file = not os.path.exists(log)
    with open(log, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["date", "title", "angle", "topic", "status", "source"])
        w.writerow([date.today(), title, cand["angle"], cand["topic"], "draft", cand["source"]])
    print(f"✅ 已登记到 content-log.csv（status=draft）")
    return out

if __name__ == "__main__":
    main()
