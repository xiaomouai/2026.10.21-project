# UniCRM（unified-crm）

面向**中小企业**的 SaaS CRM —— 整合两套开源源码的统一骨架：

| 源 | 说明 | 取入资产 |
|---|---|---|
| `../crm`（Comp AI CRM v1.15） | Agentic-first CRM（monorepo：Next 前端 + NestJS API + eve 研究 agent） | Agent 运行时模型（AgentTask/AgentRun/AgentRunEvent）、Deal 语义、领域命名风格 |
| `../nextcrm-app`（NextCRM v0.22） | 功能型中小企业 CRM（Next.js 单体） | CRM 业务语义（Accounts/Contacts/Leads/Opportunities/Activities）、发票/项目等模块迁移路线 |
| 全新 | SaaS 底座 + 工程协作 | Organization/Member 租户模型、**多 Agent 编码任务日志**（AgentJob） |

> 两套源码保持原样未被改动，本仓库为「新建统一骨架」，按优先级逐步并入两侧模块。

## 技术栈

- **Next.js 16**（App Router）+ React 19 + Tailwind CSS v4
- **Prisma 7** + SQLite（开发即跑）→ PostgreSQL（生产，schema 保持兼容，见 `docs/MIGRATION.md`）
- **better-auth** 邮箱密码认证；组织即租户（OrganizationMember 角色 OWNER/ADMIN/MEMBER/VIEWER）
- pnpm workspace monorepo（`apps/web` + `packages/db`）

## 快速开始

```bash
pnpm install
pnpm db:migrate          # prisma migrate dev（自动建库建表，SQLite 无需外部依赖）
pnpm dev                 # http://localhost:81
```

1. 打开 `http://localhost:81/register` 注册
2. 注册后进入 onboarding **创建组织**（即租户）
3. 进入工作台 → 销售总览页点击 **「✨ 载入演示数据」**：
   - CRM 业务样例（3 家企业 / 联系人 / 线索 / 商机 / 跟进）
   - **本次「两套源码整合」真实执行的多 Agent 编码任务**（7 条，AgentJob 模块首播）

## 主要模块

- **销售总览** `/w/{slug}/dashboard`
- **CRM 客户管理**：企业 `/crm/companies` · 联系人 `/crm/contacts` · 线索 `/crm/leads` · 商机 `/crm/opportunities` · 跟进 `/crm/activities`
- **AI Agent 协作**：编码任务日志 `/dev/agent-jobs`（看板 + REST 上报，供多个编码 agent 并行开发时记录任务）· Agent 运行记录 `/dev/agent-runs`（Comp AI 运行时资产）
- **组织设置** `/settings/members`

## 文档

- `docs/ARCHITECTURE.md` —— 整合架构与模块来源矩阵
- `docs/MIGRATION.md` —— 待并入业务模块 / 生产化迁移路线（逐周切换清单）
- `docs/MULTI_AGENT_LOG.md` —— 多 Agent 编码任务日志模块设计 + 接入规范

## 多租户现状（首版边界）

租户底座（Organization/Member + 角色）与**数据层 orgId 列/索引已落地**，所有页面/action 均按组织过滤；
跨组织会话切换、邀请、订阅计费、全部业务表细化迁移见 `docs/MIGRATION.md`。
