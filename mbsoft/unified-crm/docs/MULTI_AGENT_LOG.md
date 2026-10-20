# 多 Agent 编码任务日志（AgentJob）模块说明

## 定位

本次商机 agent 接入复用本日志体系：`agent-builder` 负责编排，`github-opportunity` 负责公开信号发现，`qa` 负责验证。每次执行同时写入 `AgentTask`、`AgentRun` 和 `AgentRunEvent`；GitHub 结果只落为 `Lead`，需要人工确认后再转商机。

UniCRM 面向「多个编码 agent 并行开发一套系统」的工程治理场景：
项目 lead 下达任务 → agent 领任务（可 REST 上报）→ 看板统一记录 **状态 / 进度 / 耗时 / 结果**，
并在工作台实时可见。模型为独立表 `AgentJob`（区别于 Comp AI 的数据研究 agent 运行时资产 AgentRun）。

## 数据模型（AgentJob）

| 字段 | 说明 |
|---|---|
| agentRole | lead / be / fe-canvas / fe-ui / pay / qa / docs（对齐项目领地制） |
| taskCode | 任务编号，对齐 `agent/<角色>/TASK-xxx` 分支惯例 |
| title / description | 标题与任务说明 |
| branch | 代码分支 |
| status | QUEUED / RUNNING / REVIEW / BLOCKED / DONE / FAILED |
| priority | P0（紧急）/ P1 / P2 / P3 |
| progress | 0-100，DONE 自动 100 |
| startedAt / finishedAt / durationMs | 状态机自动维护（进入 RUNNING 记开始；DONE/FAILED 记结束与耗时） |
| resultSummary / error | agent 汇报的结果摘要 / 错误 |
| tags / parentJobId | 标签 / 父子任务 |
| createdById | 下达人 |
| orgId | 租户隔离 |

状态机：`QUEUED → RUNNING ⇄ BLOCKED`；`RUNNING → REVIEW → DONE/FAILED`；终态可改回重开。

## 三类写入入口

1. **UI 看板下达**：`/w/{slug}/dev/agent-jobs` →「下达任务」
2. **Server Action**：`apps/web/lib/actions/agentJob.ts`（页面/内部流程调用）
3. **REST**（供外部编码 agent / CI 调用）：

```bash
# 登记任务
curl -X POST http://localhost:3000/api/dev/agent-jobs \
  -H 'Content-Type: application/json' \
  -d '{"orgSlug":"<你的组织slug>","agentRole":"fe-ui","taskCode":"TASK-010",
       "title":"实现 xx","branch":"agent/fe-ui/TASK-010-xx",
       "createdByEmail":"you@example.com"}'

# 汇报进度 / 状态
curl -X PATCH http://localhost:3000/api/dev/agent-jobs \
  -H 'Content-Type: application/json' \
  -d '{"orgSlug":"<slug>","jobId":"<返回的 id>","status":"RUNNING","progress":60,
       "resultSummary":"完成 xx"}'
```

> 首版鉴权为组织 slug 归属校验；生产化替换为 Bearer API Key（见 MIGRATION.md C4）。

## 看板能力

- 状态统计卡（进行中/排队/完成/失败）+ 各状态计数
- **角色负载**：按 agentRole 统计未完成任务，快速定位最忙/空闲角色
- 状态筛选 Tab + 角色筛选
- 任务卡片：角色徽章 / 任务编号 / 分支 / 进度条 / 耗时 / 结果摘要 / 错误高亮 / 下达人与时间
- 状态流转按钮：开始 → 交复核 → 完成 / 受阻 / 恢复 / 失败

## 本次整合的真实首播

「两套源码整合」以多 agent 方式执行：架构(lead) → 数据层(be) → 认证与外壳(fe-ui) → CRM 页(fe-ui) →
Agent 日志看板(fe-canvas) → 验证(qa)。7 条真实任务记录在 `apps/web/lib/demo-data.ts`，
注册建组织后点「✨ 载入演示数据」即可把该时间线灌入自己的租户（TASK-006 验证任务初始为 RUNNING，
构建验证通过后标记 DONE——与真实进度一致）。
