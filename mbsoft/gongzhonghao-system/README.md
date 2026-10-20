# 公众号增长操作系统 · WeChat Growth OS

> 参考 [dbskill](https://github.com/dontbesilent2025/dbskill) 的 Skill 模块化设计思想，
> 将「选题 → 内容 → 发布 → 引流 → 转化 → 产品 → 数据复盘 → 归档沉淀」做成一套可复用、可跟踪、可自动化的 SOP。
>
> 核心闭环：**流量 ⇄ 销售 ⇄ 产品**（三者互相喂养，而非线性漏斗）
>
> 适用：帮助企业搭建 AI 智能体系统的团队，但题材不局限于此 —— 任何依赖内容获客的专业服务/知识产品均适用。

---

## 一、设计哲学（为什么参考 dbskill）

dbskill 的关键设计值得借鉴的有三条，本系统一一对应落地：

| dbskill 做法 | 本系统对应 |
|---|---|
| 从大量真实素材中提炼「知识原子」，结构化沉淀 | `knowledge/` 知识库：选题原子、标题模板、钩子、 objection 应对话术 |
| `/dbs` 一个入口，自动判断「单项 or 主+辅组合」 | `/gzo` 总入口 + Skill 编排规则（1 主 + 最多 2 辅） |
| 更新不破坏本地存档、报告、决策记录 | `archive/` 与 `data/` 分离，`scripts/update_*.py` 只追加不覆盖 |

**核心原则：原子化、可编排、可追溯。**

- **原子化**：每篇内容、每次实验、每个客户线索都是一条可被检索的记录。
- **可编排**：复杂任务不堆在一个 Prompt 里，而是「主 Skill + 辅助 Skill」共同交付。
- **可追溯**：今天发的每一篇内容，都能追溯到它来自哪个选题假设、带来了多少阅读、多少线索、多少成交。

---

## 二、目录结构

```
gongzhonghao-system/
├── README.md                       # 本文件：架构与闭环说明
├── SKILL.md                        # /gzo 总入口（仿 dbskill 的 /dbs）
├── skills/                         # 可编排的能力单元（每个 = 一个 SOP + 模板）
│   ├── gzo-diagnosis.md            # 业务诊断：定位流量/销售/产品哪个环节卡住
│   ├── gzo-topic.md                # 选题：从知识库+热点生成选题假设
│   ├── gzo-content.md              # 写作：标题/钩子/正文/CTA 生成
│   ├── gzo-publish.md              # 发布：排版、定时、多平台分发
│   ├── gzo-traffic.md              # 流量：投放/分发/SEO/私域引流
│   ├── gzo-convert.md              # 销售转化：钩子设计、私域承接、成交话术
│   ├── gzo-product.md              # 产品：从反馈提炼产品需求、定价、交付
│   ├── gzo-data.md                 # 数据复盘：日/周/月报表 + 归因
│   └── gzo-archive.md              # 归档：沉淀知识原子、更新知识库
│
├── workflows/                      # 组合多个 Skill 的完整 SOP 流水线
│   ├── daily-flow.md               # 日流程：今天写什么、发什么、盯什么
│   ├── weekly-review.md            # 周复盘：哪篇爆了、哪个渠道有效、决策记录
│   ├── monthly-strategy.md         # 月战略：流量-销售-产品三角校准
│   └── new-client-onboard.md       # 新客户从 0 到 1 搭建流程
│
├── knowledge/                      # 知识库（知识原子 + 方法论）
│   ├── topic-atoms.md              # 选题原子库（题材×痛点×角度）
│   ├── title-templates.md          # 标题公式与模板
│   ├── hook-library.md             # 开头钩子库
│   ├── cta-library.md              # 行动召唤模板（引流到私域）
│   ├── objection-handling.md       # 客户异议应对（贵/不需要/再看看）
│   ├── product-feedback-loop.md    # 产品迭代闭环方法论
│   └── _index.md                   # 知识库索引（RAG 友好）
│
├── templates/                      # 可直接复制填写的模板
│   ├── article-template.md         # 文章骨架模板
│   ├── experiment-record.md        # 实验记录模板（每篇内容=一次实验）
│   ├── lead-tracker.md             # 线索登记表
│   ├── weekly-review-template.md   # 周复盘模板
│   └── monthly-strategy-template.md# 月战略模板
│
├── data/                           # 运行数据（每日追加，不覆盖）
│   ├── daily-metrics/              # 每日指标（YYYY-MM-DD.csv）
│   ├── content-log.csv             # 内容发布台账
│   ├── experiment-log.csv          # 实验记录台账
│   ├── lead-log.csv                # 线索台账
│   ├── deal-log.csv                # 成交台账
│   └── _schema.md                  # 各表字段定义
│
├── archive/                        # 归档：按月份沉淀，永不删除
│   ├── 2026-09/
│   └── README.md                   # 归档规则
│
├── scripts/                        # 自动化脚本（Python，环境无关）
│   ├── daily_collect.py            # 每日数据采集 + 生成日报
│   ├── publish_queue.py            # 发布队列管理（定时/重试）
│   ├── weekly_review.py            # 自动生成周复盘报表
│   ├── monthly_calibrate.py        # 月度三角校准计算
│   ├── knowledge_sync.py           # 知识库同步/去重
│   ├── backup_archive.py           # 归档备份（只追加）
│   ├── notify.py                   # 通知（企业微信/邮件/飞书）
│   ├── gen_diagrams.py             # 生成架构图/闭环图
│   ├── test_all.py                 # 端到端测试
│   └── requirements.txt
│
├── docs/                            # 架构图 / 闭环图（自动生成）
│
├── start.sh / start.bat             # 一键启动脚本（Mac/Linux & Windows）
├── 运行指南.md                      # 本地运行详细指南
│
├── config.example.yaml              # 配置样例（账号、渠道、webhook、阈值）
├── .env.example                     # 环境变量样例（密钥占位）
├── .gitignore                      # 忽略 .env / 本地数据
└── LICENSE                         # CC BY-NC 4.0（与 dbskill 一致）
```

---

## 三、系统架构图

```
┌─────────────────────────────────────────────┐
│  入口层   │  /gzo 总入口（自动判断单项/组合）    │
├─────────────────────────────────────────────┤
│  能力层   │  9 个 Skill（诊断/选题/写作/发布/   │
│  (Skills) │  流量/转化/产品/数据/归档）         │
├─────────────────────────────────────────────┤
│  流程层   │  日流程 / 周复盘 / 月战略 /         │
│ (Workflows)│  客户搭建                          │
├─────────────────────────────────────────────┤
│  知识层   │  选题原子 / 标题公式 / 钩子库 /      │
│           │  CTA库 / 异议库                     │
├─────────────────────────────────────────────┤
│  数据层   │  daily-metrics / content-log /     │
│           │  experiment-log / lead-log / deal-log│
└─────────────────────────────────────────────┘
```

> 分层架构图 `docs/arch.png` · 闭环图 `docs/loop.png`（由 `scripts/gen_diagrams.py` 生成）

---

## 四、核心闭环：流量 ⇄ 销售 ⇄ 产品

**不是「流量 → 销售 → 产品」的线性漏斗，而是三角循环。**

```
                ┌──────────┐
                │   流量    │  内容获客 / 投放 / 分发
                │ Traffic  │◄────────────┐
                └────┬─────┘             │
                     │ 线索              │ 产品带来口碑/案例
                     ▼                   │
                ┌──────────┐             │
                │   销售    │  私域承接   │
                │  Sales   │◄────────────┤
                └────┬─────┘  成交       │
                     │ 客户反馈          │
                     ▼                   │
                ┌──────────┐             │
                │   产品    │  智能体方案 │
                │ Product  ├─────────────┘
                └──────────┘  交付/迭代
```

**三个反馈回路（这是方法论的关键）：**

1. **流量 → 销售**：内容带来的线索，进入私域后转化效率如何？—— 决定「该写什么」。
2. **销售 → 产品**：客户在成交前反复问什么、拒绝什么？—— 决定「产品该改什么」。
3. **产品 → 流量**：交付后的案例、口碑、样板间 —— 决定「什么内容最能获客」。

**每天的动作都服务于这三个回路。** 数据复盘的本质，就是判断当前哪个回路最堵，下周资源往哪倾斜。

---

## 五、Skill 编排规则（仿 dbskill）

> 一个入口 `/gzo`，自动判断单项还是组合。

- **简单任务** → 单个 Skill 直接交付。
- **复杂任务** → 1 个主 Skill + 最多 2 个辅助 Skill，共同交付一份统一结果。
- **每轮结束后**补充新事实或反馈，重新编排。

具体调用示例见 `SKILL.md`。

---

## 六、快速开始

### 方式 A：一键启动（推荐）

```bash
# Mac / Linux
chmod +x start.sh && ./start.sh

# Windows
start.bat
```

脚本会自动：检查 Python → 安装依赖 → 初始化数据表 → 跑通端到端测试。

### 方式 B：手动

```bash
# 1. 克隆 / 下载本目录
cp config.example.yaml config.yaml
cp .env.example .env          # 填入公众号/私域/通知的密钥

# 2. 安装依赖
pip install -r scripts/requirements.txt

# 3. 初始化数据表
python scripts/daily_collect.py --init

# 4. 跑一次日流程（采集 + 日报）
python scripts/daily_collect.py

# 5. 每周复盘
python scripts/weekly_review.py

# 6. 每月校准
python scripts/monthly_calibrate.py
```

> 📖 更详细的本地运行说明见 **[运行指南.md](运行指南.md)**，包含环境准备、配置填写、真实数据接入（公众号/企微/CRM API）、常见问题。

**不写代码的最小用法**：只看 `workflows/daily-flow.md`，每天按表格填写 `data/daily-metrics/YYYY-MM-DD.csv` 即可。脚本只是把重复劳动自动化。

---

## 七、数据跟踪维度（每天必填）

| 维度 | 核心指标 |
|---|---|
| 流量 | 阅读量、分享、新增关注、外部分发点击 |
| 销售 | 线索数、私域新增、有效沟通数、成交数、GMV |
| 产品 | 交付数、NPS/满意度、退款、迭代需求数 |
| 内容 | 发布篇数、选题假设验证、爆款率、CTA 点击率 |

详见 `data/_schema.md`。

---

## 脚本一览

| 脚本 | 作用 | 何时用 |
|---|---|---|
| `daily_collect.py` | 采集当日数据 + 生成日报 + 异常标红 | 每天 |
| `publish_queue.py` | 发布队列：定档/重试/登记台账 | 发布前 |
| `weekly_review.py` | 汇总 7 天 + 内容归因 + 假设验证 | 每周五 |
| `monthly_calibrate.py` | 三段转化率对照基准 + 三角校准 | 每月末 |
| `knowledge_sync.py` | 知识库去重 + 重建索引 | 沉淀新知识后 |
| `backup_archive.py` | 只追加的归档备份（支持远程） | 定期 |
| `notify.py` | 企微/飞书/邮件多渠道通知 | 配合 --notify |
| `gen_diagrams.py` | 生成架构图 / 闭环图 | 需要时 |
| `test_all.py` | 端到端测试 | 部署/改动后 |

详见 `运行指南.md`。

---

## 八、许可证

CC BY-NC 4.0 · 灵感来自 [dontbesilent/dbskill](https://github.com/dontbesilent2025/dbskill)
