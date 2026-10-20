# UniCRM 操作手册（AI-Native 中小企业 CRM）

> 适用版本：unified-crm（Next.js 16 + Prisma + 多 Agent 编码任务日志）
> 本文面向**管理员 / 运营**，讲解日常操作；后端部署见 `docs/DOCKER_DEPLOY.md`，PG 生产切换见 `docs/PROD_PG.md`。

---

## 一、登录与组织

1. 打开站点（本地 `http://localhost:81`，生产为你的域名）。
2. 已有账号直接「登录」；新账号走「注册 → 创建/加入组织（onboarding）」。
3. 演示账号取决于本地数据库，请由部署者提供测试凭据。

登录后 URL 形如 `/w/<你的组织slug>/dashboard`，所有业务页都在 `/w/[slug]/` 下，按组织隔离数据。

---

## 二、工作台导航

左侧 **Sidebar** 为业务区入口（组织内可见）：

- **Dashboard** — 概览
- **CRM** — 企业客户、销售线索、商机、活动
- **Dev / Agent** — Agent 任务看板、Agent 运行记录（AI 溯源）
- **设置 / AI 能力** — 模型配置、提案概况、Agent 调度台、邮件草稿
- **设置 / 成员** — 组织成员与角色

右上角（用户菜单左侧）为 **背景主题切换器**：白色 / 浅色羊皮纸 / 深色，点击即换、刷新不丢。

---

## 三、配置大模型（核心：无需改后端、无需重启）⭐

> 痛点已解决：模型供应商 / API Key / 模型名 / 自定义端点现在**全部在界面编辑**，存数据库，保存即生效。
> 仅 **组织所有者（OWNER）/ 管理员（ADMIN）** 可修改。

### 3.1 进入配置页
「设置」→「AI 能力」→ 页面下方「**模型供应商配置**」卡片。

### 3.2 选择供应商并保存
界面提供 5 个选项（单选）：

| 选项 | 说明 | 需填 Key | 默认模型 |
|---|---|---|---|
| 通义千问 Qwen | 阿里云百炼 DashScope 兼容 | `DASHSCAPE_API_KEY` | `qwen-plus` |
| DeepSeek | DeepSeek 官方 API | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| OpenAI | OpenAI 官方 API | `OPENAI_API_KEY` | `gpt-4o-mini` |
| 自定义兼容端点 | vLLM / Ollama / 中转等任意 OpenAI 兼容 | `AI_API_KEY` | 自定义 |
| 关闭 LLM | 纯本地规则引擎（零成本演示） | 无 | — |

操作步骤：
1. 选中一个供应商（如「通义千问 Qwen」）。
2. 在 **API Key** 框填入对应 Key（密码框，不回显明文；已保存过会显示 `••••尾4位`，留空表示保留旧值）。
3. 「模型」可选填，覆盖默认（如 `qwen-max` / `deepseek-reasoner`）。
4. 选「自定义兼容端点」时，必须填 **Base URL**（含 `http(s)://`，如 `https://your-endpoint/v1`）。
5. 点 **「保存配置」** → 提示「已保存，立即生效（无需重启）」。

### 3.3 生效状态怎么看
卡片顶部「当前生效」实时显示：

- 🟢 **LLM 模式** — 已连通，AI 动作走模型
- 🟡 **降级（无 Key）** — 未配 Key，自动回落本地规则引擎（功能仍可用，置信度偏低需人工确认）
- 🟡 **已关闭（规则引擎）** — 你选了「关闭 LLM」
- 来源标注：**界面配置**（你刚存的）或 **环境变量**（沿用后端 `.env`）

### 3.4 重置回环境变量默认
若之前在界面配过，想回到后端 `.env` 配置：点 **「清除界面配置（回到 .env 默认）」** 即可，数据库记录删除、立即生效。

### 3.5 与环境变量的关系（两级配置）
优先级：**界面配置（数据库）> 环境变量 > 无（降级规则引擎）**。

- 从未在界面配置过时，系统完全沿用后端 `.env`（`UCRM_LLM_PROVIDER` / `DASHSCOPE_API_KEY` / `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` / `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`），行为与旧版一致。
- `UCRM_LLM_PROVIDER=qwen` 会自动识别为通义千问（`dashscope`）。
- 环境变量始终作为**兜底默认**：界面保存了具体供应商但 Key 留空、且环境变量有对应 Key 时，仍能连通。
- 选了具体供应商却**既无界面 Key 也无环境变量 Key** → 保存被拒绝（提示先填 Key）。

> 安全说明：Key 以明文存于自托管数据库（部署约定）；界面仅回显尾 4 位，切换供应商旧 Key 仍保留在库可随时切回。

---

## 四、AI 功能使用

### 4.1 线索 / 客户 AI 建档
- 在「销售线索」或「企业客户」列表，对单条记录点 **「AI 建档」**。
- 系统先跑本地规则兜底，若有 LLM 通道再跑模型合并，产出**提案（AiFact）**。
- AI 只产提案，**不自动写入**业务数据；你在溯源看板确认采纳后，才真正写入，且保留证据与来源、可回放。

### 4.2 邮件草稿
「设置 / AI 能力」→「邮件草稿」卡片：选目标（线索/客户），生成跟进邮件草稿；无 Key 时走规则模板，有 Key 时由模型润色。

### 4.3 Agent 调度台
「设置 / AI 能力」→「Agent 调度台」：查看 / 触发编码任务类 Agent（enrich / reminder / draft），双泳道（fast 规则 + llm 模型降级）状态一目了然。

### 4.4 AI 动作溯源看板
「Dev / Agent 运行」或「AI 能力」页底部「最近运行」：每张运行记录含模式（LLM/规则）、模型、耗时、结果，点击可溯源到对应的 `idempotencyKey` 与提案证据。

---

## 五、背景主题切换
右上角主题切换器三档：**白色（默认）/ 浅色羊皮纸（护眼）/ 深色**。选择写入浏览器 `localStorage`，刷新不丢，全局生效（含登录页），纯前端、不影响后端。

---

## 六、成员管理（管理员）
「设置 / 成员」：邀请成员、调整角色（OWNER / ADMIN / 普通成员）。模型配置等敏感操作仅 OWNER/ADMIN 可见可改。

---

## 七、部署（Docker，国内镜像）
快速开始（详见 `docs/DOCKER_DEPLOY.md`）：

```bash
cd unified-crm
cp .env.docker.example .env.docker   # 改 POSTGRES_PASSWORD 与各 LLM Key
docker compose up -d --build
# 访问 http://<服务器IP>:81
```

生产建议 PostgreSQL（已内置 adapter 自动切换） + 可选 Caddy 反代自动 HTTPS。

---

## 八、常见排错

| 现象 | 原因 / 处理 |
|---|---|
| AI 动作只出规则结果、状态「降级（无 Key）」 | 没填 Key。去「模型供应商配置」填对应 Key 保存，或后端 `.env` 配 `DASHSCOPE_API_KEY` 等并重启 |
| 保存时报「请填写该供应商的 API Key」 | 选了具体供应商但界面与环境变量都无 Key |
| 自定义端点保存失败 | Base URL 必须含 `http(s)://` 且为合法地址 |
| 选 DeepSeek 却 401 | 旧版 `||` 拼 Key 的 bug 已修复；现在严格按 provider 取专属 Key，确保填的是 `DEEPSEEK_API_KEY` |
| 改了 `.env` 不生效 | 环境变量需重启进程/容器；若要免重启，直接在界面配置（保存即生效） |
| 主题切换后某页颜色怪 | 个别存量 `slate` 类已做 `[data-theme]` 兜底；如仍异常请反馈 |

---

*生成于 2026-09-08。配套文档：DOCKER_DEPLOY.md（部署）、PROD_PG.md（生产 PG）、AI_NATIVE_P0.md（AI 架构路线图）。*
