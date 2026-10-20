# 迁移路线（MIGRATION）

从两套源码并入本骨架的**未完成项**与**生产化项**，按周批次推进。

## A. 业务模块并入（来自 nextcrm-app）

| 批次 | 模块 | 说明 | 涉及 |
|---|---|---|---|
| A1 | 发票 Invoices | nextcrm 7 张 Invoice_* 表 + line items/tax/payments/PDF/Resend | 新增模型 + 页面/actions |
| A2 | 项目协作 Projects/Boards | 看板 + 任务 + Watchers | 新增模型 + UI |
| A3 | 邮件客户端 Emails | IMAP/SMTP + link-crm 同步 + 邮箱加密 | nextcrm lib/email-* |
| A4 | 文档中心 Documents | 7 张 DocumentsToXxx 关联 + tiptap 编辑 | 新增模型 + UI |
| A5 | 报表 Reports | Tremor 图表 + 定时导出 | inngest 迁移后接入 |
| A6 | 营销 Campaigns | 邮件营销 templates/steps/sends | 新增模型 + inngest |
| A7 | 员工/数据盒子/全文检索 | 向量嵌入（pgvector）需 PG | 切 PG 后并入 |

> 每个模块并入时：先加 `orgId` 列与索引 → 页面/action 按组织过滤 → 在对应列表页标注「来源」。

## B. Comp AI（crm/）深度资产

| 项 | 说明 | 依赖 |
|---|---|---|
| eve 研究 agent 调度 | AgentTask 队列 + `FOR UPDATE SKIP LOCKED` 抢占改为按组织分区队列 | 引入 eve SDK/工具链 |
| Agent Builder 可视化 | 配置 agent / 与 agent 聊天 | 需 org 化改造 |
| 邮件/日历/Slack 集成 | Google/MS Graph/Slack 同步 | 按租户凭据、scopes 重做 |
| 网站追踪 t/[site]/crm.js | 站点访客追踪 | 需 org 域名绑定 |

## C. SaaS 生产化（多租户补全）

1. **认证**：邮箱验证、Google SSO、重置密码、邀请链接（better-auth plugins 逐项开）
2. **租户**：跨组织会话切换（active org cookie）、成员管理 UI（增删/改角色）、成员上限按 plan
3. **计费订阅**：Stripe → plan/status/trialEndsAt 联动；M/L 档预付款约定可配置
4. **API Key**：为 REST 上报（`/api/dev/agent-jobs`）换 Bearer token；`x-dev-key` 临时方案退役
5. **审计**：AgentJob/AgentRun 保留期策略；组织级操作审计

## D. 数据库生产切换（SQLite → PostgreSQL）

```bash
# 1. schema.prisma: provider = "postgresql"
# 2. packages/db/src/index.ts: 按 DATABASE_URL 协议分支选 adapter
#    （@prisma/adapter-pg + pg）
# 3. pnpm --filter @ucrm/db db:deploy   # migrate deploy
# 4. 向量能力（pgvector）随 A7 加入
```

设计上避免 enum/citext/数组等 DB 专有类型，Decimal/Json/DateTime 两库通用，切换成本低。

## E. 工程化补全

- 迁移两侧组件库（Comp AI shadcn / NextCRM primereact）为统一轻 UI 或按页引入
- E2E（Playwright）：登录 → 建组织 → 载入演示数据 → 看板冒烟
- CI：type-check + build + migrate 校验
