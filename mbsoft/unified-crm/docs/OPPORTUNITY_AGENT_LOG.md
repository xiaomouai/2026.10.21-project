# 商机 Agent 执行日志

日期：2026-09-08

| 步骤 | 状态 | 证据 |
|---|---|---|
| 阅读 CRM、AgentTask、AgentRun、AgentJob 与商机模型 | 已完成 | `apps/web/lib/ai/dispatch.ts`、`apps/web/lib/ai/opportunity-agent.ts`、`packages/db/prisma/schema.prisma` |
| 复用现有队列和运行审计 | 已完成 | GitHub 任务写入 `AgentTask`，执行写入 `AgentRun` / `AgentRunEvent` |
| 接入 GitHub 公开 issue 搜索 | 已完成 | `POST /api/dev/opportunity-agent` |
| 结果去重并写入 CRM | 已完成 | 按组织 + GitHub URL 去重，写入 `Lead`，不自动虚构金额或成交阶段 |
| TypeScript 检查 | 已验证 | `apps/web/node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` 通过 |
| GitHub 实际联网抓取 | 已验证 | 本地 `8081` + 组织 `org-7hmk`：读取 10 条公开 issue，新增 10 条 Lead；`AgentRun=COMPLETED` |
| 重复执行去重 | 已验证 | 第二次同查询读取 10 条，新增 0 条；`AgentTask=DONE`，attempts=1 |
| 真实商机、询盘、付款 | 未验证 | GitHub 公开 issue 只是需求信号，必须人工确认后转商机 |

## 调用示例

```bash
curl -X POST http://localhost:81/api/dev/opportunity-agent \
  -H 'Content-Type: application/json' \
  -d '{"orgSlug":"<slug>","query":"CRM SaaS","runNow":true}'
```
