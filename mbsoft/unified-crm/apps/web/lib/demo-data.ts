// 演示数据模板（仅供各租户一键载入体验）。
// AGENT_JOBS 段落 = 「两套源码整合」真实执行的多 Agent 任务记录（本次会话实施），
// 随「载入演示数据」灌入当前租户，作为编码任务日志模块的首播数据。

export type DemoAgentJob = {
  agentRole: string;
  taskCode: string;
  title: string;
  description: string;
  branch: string;
  status: string;
  progress: number;
  /** 距 now 多少分钟前开始 */
  offsetMin: number;
  durationMs?: number | null;
  resultSummary?: string | null;
  error?: string | null;
  tags?: string | null;
};

export const DEMO_AGENT_JOBS: DemoAgentJob[] = [
  {
    agentRole: "lead",
    taskCode: "TASK-000",
    title: "架构总控 · 探查两套 CRM 源码并定合并方案",
    description:
      "并行探查 crm/(Comp AI CRM v1.15) 与 nextcrm-app/(NextCRM v0.22) 两套源码：技术栈、业务模块、Prisma schema、认证与多租户现状；输出差异对比，与 lead 确认三个方向性决策（新建统一骨架 / 租户先落地模型与架构层 / 编码任务日志完整做并真实首播）。",
    branch: "agent/lead/TASK-000-introspection",
    status: "DONE",
    progress: 100,
    offsetMin: 58,
    durationMs: 18 * 60_000,
    resultSummary:
      "两库 900+/1200+ 文件均无真实多租户；选定以全新 pnpm workspace 骨架整合，业务语义取双方交集，Agent 资产迁移 Comp AI。",
    tags: "research,architecture",
  },
  {
    agentRole: "be",
    taskCode: "TASK-001",
    title: "后端 · 统一骨架与合并数据模型（租户+CRM+Agent 资产）",
    description:
      "搭建 pnpm workspace（packages/db + apps/web）；编写 schema.prisma：better-auth 认证模型、SaaS 租户（Organization/OrganizationMember）、CRM 业务（Company/Contact/Lead/Opportunity/Activity）、Comp AI Agent 运行时（AgentTask/AgentRun/AgentRunEvent）、全新 AgentJob 编码任务日志；DB 兼容约定 SQLite 即跑、生产平滑切 PG。",
    branch: "agent/be/TASK-001-schema",
    status: "DONE",
    progress: 100,
    offsetMin: 47,
    durationMs: 11 * 60_000,
    resultSummary:
      "schema 17 个模型，均含 orgId 与索引；数据层多租户字段先落地，UI 按组织过滤。",
    tags: "schema,db,saas",
  },
  {
    agentRole: "be",
    taskCode: "TASK-002",
    title: "后端 · PrismaClient 运行时适配（SQLite driver adapter）",
    description:
      "db 包封装 PrismaClient 单例（@prisma/adapter-better-sqlite3），数据库文件与 prisma migrate 落盘一致；领域常量字典拆分独立导出路径避免进浏览器 bundle；prisma.config.ts 统一 CLI。",
    branch: "agent/be/TASK-002-db-client",
    status: "DONE",
    progress: 100,
    offsetMin: 40,
    durationMs: 4 * 60_000,
    resultSummary: "本地 SQLite 可立即运行；切 PG 仅需 provider+adapter，见 docs/MIGRATION.md。",
    tags: "db,infra",
  },
  {
    agentRole: "fe-ui",
    taskCode: "TASK-003",
    title: "前端 · 认证流程 + 组织创建 + 工作台外壳",
    description:
      "better-auth 邮箱密码登录注册；注册后 onboarding 建组织（OWNER 成员）；/w/{slug} 工作台 layout：侧边导航（客户管理 / AI Agent 协作 / 组织）+ 顶栏（套餐与试用）+ 成员校验。",
    branch: "agent/fe-ui/TASK-003-auth-shell",
    status: "DONE",
    progress: 100,
    offsetMin: 26,
    durationMs: 14 * 60_000,
    resultSummary: "登录→建组织→工作台全链路打通；页面均服务端校验成员资格。",
    tags: "auth,ui,layout",
  },
  {
    agentRole: "fe-ui",
    taskCode: "TASK-004",
    title: "前端 · CRM 业务页（企业/联系人/线索/商机/跟进）",
    description:
      "轻量 UI 原语（Tailwind v4 自建，无重组件库）；配置驱动的「新建记录」弹窗绑定 Server Action；行内状态流转；五个列表页 + 销售总览 Dashboard（统计卡/高价值商机/待办/最近动态）。",
    branch: "agent/fe-ui/TASK-004-crm-pages",
    status: "DONE",
    progress: 100,
    offsetMin: 12,
    durationMs: 12 * 60_000,
    resultSummary: "公司/联系人/线索/商机/跟进 + Dashboard 共 6 页，全部按 orgId 隔离取数。",
    tags: "crm,ui",
  },
  {
    agentRole: "fe-canvas",
    taskCode: "TASK-005",
    title: "前端 · 编码任务日志看板 + REST 上报 API",
    description:
      "AgentJob 看板（状态统计/角色负载/状态筛选/任务卡片/进度条/耗时）+「下达任务」弹窗 + 状态流转；REST 端点 POST|PATCH /api/dev/agent-jobs 供外部编码 agent 上报；看板内置 curl 接入说明。",
    branch: "agent/fe-canvas/TASK-005-agent-log",
    status: "DONE",
    progress: 100,
    offsetMin: 4,
    durationMs: 10 * 60_000,
    resultSummary: "编码任务日志完整可用：UI 登记 / Server Action / REST 三种写入路径均已实现。",
    tags: "agent-log,api,ui",
  },
  {
    agentRole: "qa",
    taskCode: "TASK-006",
    title: "验证 · 依赖安装 / 迁移 / 构建 / 冒烟",
    description:
      "pnpm 安装（放行原生模块构建）、prisma migrate dev 建库、tsc 与 next build 验证、启动 dev server 冒烟检查登录与看板，修复发现的问题。",
    branch: "agent/qa/TASK-006-verify",
    status: "RUNNING",
    progress: 60,
    offsetMin: 0,
    resultSummary: null,
    tags: "qa,build,verify",
  },
];
