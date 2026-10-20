# 整合架构方案（ARCHITECTURE）

> 目标：把 `crm/`（Comp AI CRM）与 `nextcrm-app/`（NextCRM）两套源码，整合为一套**面向中小企业、SaaS 架构、Next.js 技术栈**的 CRM。

## 一、决策记录（与 lead 确认）

| 决策项 | 结论 | 理由 |
|---|---|---|
| 合并主体 | **新建统一骨架**（本仓库），两套原码不动 | 两套均 900+/1200+ 文件、均无真实多租户，直接在任一源码内改造风险高；骨架方式可逐步并入两侧资产 |
| SaaS 多租户深度（首版） | **租户模型 + 架构层落地**：Organization/Member/角色 + 全部核心业务表加 orgId + 查询按组织过滤 | 数据层隔离即刻生效、可验证；业务表细化迁移逐周做 |
| Agent 任务日志 | **工程协作模块完整实现 + 本次整合真实首播** | 差异化能力，可演示多 agent 并行开发的进度治理 |
| 数据库 | Prisma 7 · 本地 SQLite（立即可跑），schema 保持 PG 兼容 | 本机无 docker/Postgres，先跑通再切生产 |

## 二、仓库结构

```
unified-crm/
├─ apps/web                 Next.js 16 应用
│  ├─ app/                  (auth): login/register/onboarding/resolve
│  │                        w/[slug]/: dashboard · crm/* · dev/agent-jobs · dev/agent-runs · settings/members
│  │                        api/auth/[...all] · api/dev/agent-jobs (REST)
│  ├─ components/           ui 原语 + app(crm/agent-jobs 组件)
│  └─ lib/                  auth · session · org · actions(server) · demo-data · fmt
└─ packages/db              Prisma schema + client + 领域常量（@ucrm/db）
```

## 三、数据模型来源矩阵

| 模型 | 来源 | 备注 |
|---|---|---|
| User/Session/Account/Verification | better-auth | 认证 |
| Organization / OrganizationMember | 全新（SaaS 底座） | 组织=租户；角色 OWNER/ADMIN/MEMBER/VIEWER；plan/status/trialEndsAt |
| Company | nextcrm `crm_Accounts` ≡ Comp AI `Company` | 企业客户；orgId+索引 |
| Contact | 两套共有（Comp AI Contact 语义命名） | 关联 Company |
| Lead | nextcrm 独有 | Comp AI 无直接对应，负责获客漏斗 |
| Opportunity | nextcrm `crm_Opportunities` ≡ Comp AI `Deal` | 商机 + stage/amount/概率 |
| Activity | 两套共有（nextcrm crm_Activities / Comp AI Activity） | 跟进多态关联 |
| AgentTask/AgentRun/AgentRunEvent | Comp AI（apps/agent 运行时） | 数据研究 agent（eve/富化）未来接入 |
| AgentJob | **全新** | 多 Agent 编码任务日志（见 MULTI_AGENT_LOG.md） |

## 四、SaaS 多租户设计（首版）

1. **租户上下文**：注册 → 建 Organization（创建人 OWNER）→ 工作台路由 `/w/{slug}`；layout 与每个 Server Action 经 `requireOrg(slug, userId)` 校验成员资格。
2. **数据隔离**：所有租户级表含 `orgId` + 索引；所有查询/写入 `where orgId`；杜绝跨租户读取。
3. **待办**：邀请成员、active org 会话切换、订阅计费、审计——见 `MIGRATION.md`。

## 五、界面与组件策略

- 全新轻 UI：Tailwind v4 + 自建原语（无 shadcn/radix 全家桶），降低首版构建风险；
- 业务页：服务端取数渲染 + Server Action 写入 + `RecordModal`（配置驱动）弹窗绑定 action；
- 列表行内状态流转用 `QuickStatus` 客户端组件。
- 若后续并入两边较重的页面（Comp AI 的 shadcn 组件、NextCRM 的 primereact 页），再按需引入对应 UI 栈。

## 六、两套上游的差异化取舍（本骨架取向）

| 能力 | Comp AI（crm/） | NextCRM（nextcrm-app/） | 本骨架 |
|---|---|---|---|
| CRM 核心 5 实体 | 有（Deal） | 有（9 大实体） | ✅ 已并入（5 实体+Activity） |
| 发票/项目/报表/邮件/文档 | 无 | 有 | 📋 迁移路线（MIGRATION.md） |
| 研究 agent（eve/Agent Builder） | 有 | 部分（enrichment） | 🧩 数据资产表已就位 |
| 多租户 | 刻意单租户 | 无 | ✅ 本骨架全新实现 |
| 编码任务治理（多 agent） | 无 | 无 | ✅ 全新 AgentJob 模块 |
