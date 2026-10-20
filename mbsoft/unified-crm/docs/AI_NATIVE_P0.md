# P0 · AI-Native 最小闭环：线索建档 Agent + 证据闸门

> 目标：让 AI 在 UniCRM 里**第一次承担真实业务动作**（补全客户/线索档案），同时让每个 AI 写入
> **可溯源、可拍板、可回放**。这是从「记录型 CRM」到「AI-Native CRM」的最小证明，也是首个可对外演示的场景。
>
> **状态：已实现并验证通过（2026-09-08）** —— tsc 0 错误、`next build` 19 路由通过、全链路冒烟通过。

---

## 1. 范围边界

| 做（P0） | 不做（后续） |
|---|---|
| 线索（Lead）自动建档：补全 company / industry / website / size / score 建议 | 自然语言问 CRM（P2） |
| 事实提案 + 证据权重 + band 分档 | 向量检索 / 混合搜索（P2，切 PG 后） |
| 写入闸门：AI 只提案，人拍板后落主表 | 浏览器沙箱研究 Agent（P3） |
| 人填值永不覆盖（humanOwns） | 租约队列 / 双泳道调度（P1） |
| 无 LLM Key 时规则降级、仍可完整演示 | MCP Server 暴露（P2） |
| 每次执行落 AgentRun 供回放 | 多专职 Agent 编排（P1） |

**对象范围**：P0 只接 `Lead` + `Company`（线索转化率最高、字段最缺）。`Contact` 留 P1。

---

## 2. 三条设计原则（不可妥协）

1. **AI 永不直接改主表** —— 一切写入先入 `AiFact` 提案池，人拍板（或 VERIFIED 白名单）才落主表。
2. **置信度外部定价** —— 不用 LLM 自评，用「证据类型权重表」合成（抄 crm/ `agent/lib/evidence.ts`）。
3. **无 Key 必须能跑** —— 声明式能力降级（抄 crm/ `lib/capabilities.ts`），本地规则兜底，演示不依赖外部环境。

---

## 3. 数据模型变更

### 3.1 新增 `AiFact`（证据账本核心）

```prisma
// AI 事实提案：AI 对某个业务字段的建议值 + 证据 + 状态机
// [AI·NEW] 借鉴 crm/ ContactFact + nextcrm EnrichmentResult{confidence, sourceContext}
model AiFact {
  id         String   @id @default(cuid())
  orgId      String
  org        Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  // entityType: LEAD / COMPANY / CONTACT
  entityType String
  entityId   String
  field      String            // 目标字段：industry / website / size / score / title ...
  value      String            // AI 建议值（统一存字符串，写入时按字段类型转换）
  currentValue String?         // 提案时的原值快照，便于 UI 对比

  confidence Float    @default(0)   // 0-1，由证据权重合成
  // band: VERIFIED(≥0.85 且含 primary 证据) / PROBABLE(≥0.55) / POSSIBLE(≥0.3)
  band       String
  // evidence Json: [{ type, weight, sourceUrl, snippet, retrievedAt }]
  evidence   Json?
  sourceUrl  String?

  // status: PROPOSED → APPLIED / SUPERSEDED / DISMISSED
  // 借鉴 crm/ recordFact 状态机
  status     String   @default("PROPOSED")

  runId      String?           // 关联 AgentRun，可回放
  decidedById String?
  decidedBy  User?    @relation("AiFactDecider", fields: [decidedById], references: [id], onDelete: SetNull)
  decidedAt  DateTime?
  reason     String?           // 未采纳原因：humanOwns / lowConfidence / dismissed
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([orgId, entityType, entityId, status])
  @@index([orgId, status])
  @@index([runId])
}
```

### 3.2 主表加 AI 元信息（Lead / Company）

```prisma
model Lead {
  // ...既有字段...
  // aiStatus: NONE / PENDING(有待审提案) / ENRICHED
  aiStatus      String   @default("NONE")
  // aiMeta Json: { field: { confidence, band, sourceUrl, factId, appliedAt } }
  aiMeta        Json?
  aiEnrichedAt  DateTime?
}
```
`Company` 同构加三字段。**作用**：① UI 列状态徽章；② `humanOwns` 判定依据（有值但 aiMeta 无该 field ⇒ 人填，AI 不得覆盖）。

### 3.3 `AgentRun` 补幂等与记账字段

```prisma
model AgentRun {
  // ...既有字段...
  idempotencyKey String?    // 24h 内同 key 跳过重跑（抄 crm/ AgentRun.idempotencyKey）
  costUsd        Float?     // P1 记账预留，P0 可空
  inputTokens    Int?
  outputTokens   Int?
}
```

### 3.4 常量（`packages/db/src/constants.ts`）

```ts
export const AI_FACT_STATUS = { PROPOSED: "待确认", APPLIED: "已采纳", SUPERSEDED: "已取代", DISMISSED: "已忽略" } as const;
export const AI_BAND       = { VERIFIED: "已核实", PROBABLE: "较可信", POSSIBLE: "待验证" } as const;
export const AI_ENTITY_TYPE= { LEAD: "线索", COMPANY: "企业", CONTACT: "联系人" } as const;
export const AI_STATUS     = { NONE: "未建档", PENDING: "待审提案", ENRICHED: "已建档" } as const;
```

---

## 4. 核心逻辑

### 4.1 证据权重表（`apps/web/lib/ai/evidence.ts`）

```ts
const WEIGHTS = {
  user_provided:  1.00,  // 用户亲填（最高）
  gov_registry:   0.90,  // 工商 / 政府公开数据
  official_site:  0.85,  // 官网（primary）
  third_party_db: 0.80,  // 企查查 / 天眼查类
  news:           0.60,
  social:         0.50,
  llm_knowledge:  0.45,  // 模型先验（最弱，不产生 VERIFIED）
  rule_infer:     0.40,  // 降级模式规则推断
};
const PRIMARY = new Set(["official_site", "gov_registry", "user_provided"]);

// 噪声独立合成：score = 1 - Π(1 - wᵢ)；存在矛盾证据压到 0.45
export function scoreEvidence(items) { /* ... */ }

// 分档：<0.3 直接丢弃不入库
export function bandFor(score, items) {
  if (score >= 0.85 && items.some(i => PRIMARY.has(i.type))) return "VERIFIED";
  if (score >= 0.55) return "PROBABLE";
  if (score >= 0.30) return "POSSIBLE";
  return null;
}
```

### 4.2 写入闸门（`apps/web/lib/actions/aiFact.ts`）

```
applyFact(orgId, factId, actorId):
  fact = 校验租户归属
  if band == null                       → DISMISSED(reason=lowConfidence)，不写主表
  if humanOwns(entity, fact.field)      → DISMISSED(reason=humanOwns)，不写主表   // 人填优先
  else:
     写主表字段 + aiMeta[field] = {confidence, band, sourceUrl, factId, appliedAt}
     同 key 旧提案 → SUPERSEDED
     fact → APPLIED(decidedBy, decidedAt)
  主表 aiStatus 重算：有 PENDING → PENDING；否则 ENRICHED
```

### 4.3 能力降级（`apps/web/lib/ai/capabilities.ts`）

| 环境 | 行为 |
|---|---|
| 配了 `AI_API_KEY` / `OPENAI_API_KEY` / `DASHSCOPE_API_KEY` | 调 LLM，强制 `response_format: json_object`，30s AbortController 超时 |
| 无 Key | **降级模式**：本地规则推断（公司名后缀 → 行业；域名 → 官网；规模关键词 → size），证据类型 `rule_infer`，置信度 0.40–0.55，仍进提案池 |
| LLM 调用失败 | 自动回落规则引擎，UI 标注「已降级」 |

> 借鉴 crm/ `capabilities.ts` 的 `markdownFor()`：把「本次可用/不可用能力」写进 AgentRun 的 result，
> UI 顶部一行灰字说明，演示时不怕没 Key。

### 4.4 执行与可观测

- 触发：`新建线索` 后可选自动入队 + 列表页「AI 建档」按钮（同步执行，超时 30s）
- 每次执行：`AgentTask{kind:"enrich_lead"}` → `AgentRun{agentName:"lead-enrich", source:"manual", idempotencyKey}` → 2–3 条 `AgentRunEvent`（plan / tool_result / summary）
- **P0 不写 AgentJob**：AgentJob 保持「编码任务」语义，避免语义污染；P2 再泛化为通用 AI 动作看板
- 幂等：同一线索 24h 内已有成功 run 则跳过（除手动强制重跑）

---

## 5. 页面方案

### 5.1 线索列表页（改动）
- 新增 **「AI」列**：徽章 `未建档 / 待审 N / 已建档`（复用 `Badge` + `statusTone`）
- 行操作加 **「AI 建档」** 小按钮（pending 态用 `useTransition`）

### 5.2 线索详情 AI 面板（新增 `components/ai/fact-panel.tsx`）
```
┌ AI 建档 · lead-enrich ─────────────────────────────┐
│ 模型 gpt-4o-mini · 耗时 1.2s · 证据 5 条 · 已降级 ⚠ │  ← 无 Key 时显示降级提示
├────────────────────────────────────────────────────┤
│ 行业      制造          [较可信 0.72]  来源:官网  [采纳][忽略]
│           原值: 空                                   │
│ 规模      11-50         [待验证 0.45]  来源:推断  [采纳][忽略]
│ 官网      xxx.com       [已核实 0.91]  来源:官网  [采纳][忽略]
└────────────────────────────────────────────────────┘
```
- 置信度徽章：VERIFIED 绿 / PROBABLE 琥珀 / POSSIBLE 灰（低置信值灰显，抄 nextcrm `apply-result.ts`）
- 每条可展开看 evidence 明细（sourceUrl 可点开）
- 「一键采纳高置信」批量按钮（≥0.85 且非 humanOwns）

### 5.3 AI 能力页（新增 `settings/ai/page.tsx`，可选）
展示：当前 Provider / 模型 / 是否降级、`AUTO_APPLY_VERIFIED` 开关（默认关）、近 10 次 AgentRun 摘要。

---

## 6. 实现文件清单

| 文件 | 动作 |
|---|---|
| `packages/db/prisma/schema.prisma` | +AiFact；Lead/Company +aiStatus/aiMeta/aiEnrichedAt；AgentRun +idempotencyKey/costUsd/tokens |
| `packages/db/src/constants.ts` | +AI_FACT_STATUS / AI_BAND / AI_ENTITY_TYPE / AI_STATUS |
| `apps/web/lib/ai/capabilities.ts` | 新建：Provider 探测 + 降级声明 |
| `apps/web/lib/ai/evidence.ts` | 新建：权重表 + scoreEvidence + bandFor |
| `apps/web/lib/ai/lead-enrich.ts` | 新建：规则兜底 → LLM，输出 facts[] |
| `apps/web/lib/actions/aiFact.ts` | 新建：enrichLead / applyFact / dismissFact（全带 org 校验） |
| `apps/web/components/ai/fact-panel.tsx` | 新建：提案面板 + 采纳/忽略 |
| `apps/web/app/w/[slug]/crm/leads/page.tsx` | 加 AI 列 + 建档按钮 + 面板挂载 |
| `apps/web/app/w/[slug]/settings/ai/page.tsx` | 新建（可选） |
| 迁移 | `pnpm --filter @ucrm/db db:migrate`（SQLite） |

---

## 7. 验收清单

- [ ] 新建线索 → 点「AI 建档」→ 产出 ≥3 条 `PROPOSED` fact，带 band + 证据来源
- [ ] 点「采纳」→ 主表字段更新 + `aiMeta` 留痕 + fact 转 `APPLIED`
- [ ] 人已填字段（如手动填过 industry）→ AI 提案被拦，`reason=humanOwns`，主表不变
- [ ] 断网/无 Key 环境 → 降级模式仍产出提案，UI 明确标注
- [ ] `dev/agent-runs` 可见本次 run 与事件轨迹
- [ ] `tsc --noEmit` 0 错误；`next build` 通过；curl 冒烟覆盖采纳/忽略两条路径
- [ ] 跨租户隔离：A 组织无法操作 B 组织的 fact（返回 403/空）

---

## 8. 实现后补充（与初版方案的偏差）

| 偏差 | 原因 | 处理 |
|---|---|---|
| **建档主战场由 Lead 改为 Company** | `Lead` 模型只有 `score/note/company/email/phone/source` 等少数可写字段，行业/官网/规模无处落地 | Company 走 industry / size / website（字段丰富、演示最强）；Lead 走 score + note（评分与跟进建议） |
| **新增 `Company.size` 字段** | 团队规模是建档高频字段，原模型没有 | 迁移 `20260908040526_company_size_field` 补列 |
| **联系方式（phone/email/address）不开放 AI 提案** | AI 编造联系方式风险高、不可验证 | 字段白名单明确排除，prompt 同步约束 |
| **新增 dev 接口 `/api/dev/ai-enrich`** | client 组件的 server action 无法用 curl 模拟验证；且 P1 调度器需要 HTTP 触发点 | GET/POST/PATCH 三方法，走会话鉴权（与既有 `/api/dev/agent-jobs` 同风格） |
| **写入改用显式字段映射** | 初版 `data: { [field]: value }` 动态键绕过 tsc，导致「字段不存在」只在运行时炸（实际踩到 `Company.size`） | 改为 switch 显式分支，让类型系统校验 |
| **待审计数不用 `groupBy`** | Prisma 7 下 `_count._all` 取值不稳定，导致徽章恒为 0 | 改为 `findMany(select: entityId)` + JS 统计 |

## 9. 实测记录（冒烟）

| 用例 | 结果 |
|---|---|
| 企业建档（无 Key 降级） | 产出 3 条：`website=mingbo-tech.com` VERIFIED 0.85（官网证据）、`industry=软件 / 互联网` POSSIBLE 0.4、`size=11-50` POSSIBLE 0.4 |
| 24h 幂等 | 重复触发返回「24 小时内已建档，可点强制重跑」 |
| 采纳 industry / size | 主表写入成功，`aiMeta` 记录 confidence/band/factId/appliedAt，`aiStatus` 重算 |
| humanOwns 拦截 | 人工先填 `website=manual-by-human.com` 后采纳官网提案 → 拒绝写入，提案转 DISMISSED(reason=humanOwns) |
| 忽略提案 | size/其他提案转 DISMISSED，状态徽章回落到「AI 建档」 |
| 线索建档 | `score=90` POSSIBLE 0.4（邮箱+25/电话+20/公司+20/转介绍+25） |
| 跨租户 | 非成员组织请求返回 307 重定向，拿不到任何提案 |
| 可观测 | `AgentRun(company-enrich/lead-enrich)` 落库：mode=rule、durationMs、result 摘要；AI 能力页可查最近 10 次 |

## 10. 与后续阶段的衔接

| 阶段 | 依赖 P0 的资产 |
|---|---|
| P1 执行基建 | `AiFact` 状态机 → 租约队列批量回补；双泳道把「本地规则」与「LLM」正式分道 |
| P2 场景包 | 「问 CRM」只读查询复用 `aiMeta` 做答案溯源；AgentJob 泛化为 AI 动作看板 |

## 11. P1 执行基建（已落地 · 2026-09-08）

把「建档 Agent」从「手动触发」升级为「租约队列 + 双泳道调度」，支持批量回补与崩溃自愈，无需 Redis/BullMQ。

### 11.1 数据模型
`AgentTask` 新增：`lane`(fast/llm)、`attempts`、`maxAttempts`(默认 3)、`leaseOwner`、`leasedUntil`、`scheduledFor`；
索引：`(status,lane,scheduledFor,priority)`、`(status,leasedUntil)`。迁移 `agent_task_lease_queue`。

### 11.2 服务层
- `lib/ai/enrich-service.ts`：抽出 `runEnrichment(orgId, entityType, entityId, {allowLlm, source})`，手动与调度共用。
- `lib/ai/dispatch.ts`：租约队列核心
  - `enqueueEnrichTask`：幂等入队（同 kind 已有 QUEUED 只更新）
  - `claimDue`：SQLite 无 SKIP LOCKED，采用「先查候选 → `updateMany(status='QUEUED')` 抢占 → 只认领到自己 leaseOwner 的」乐观领取
  - `releaseStale`：RUNNING 且 `leasedUntil<now` → `attempts<max` 回 QUEUED，否则转 FAILED
  - `dispatchOnce`：回收 → 领取 → 执行 → 完成/退避重排/失败；退避 `min(30s, 2^attempts*1s)`
  - `queueHealth`：queued/running/stalled/failed/done
- `lib/actions/aiFact.ts`：`enqueueBulkEnrichAction`(批量压 fast 泳道)、`dispatchNowAction`(触发一轮，可选 lane)。

### 11.3 入口与 UI
- REST：`POST /api/dev/agent-dispatch {orgSlug,lane?,limit?}`、`GET /api/dev/agent-dispatch?orgSlug=`（会话无关，与 agent-jobs 同风格）
- UI：`settings/ai` 页新增「Agent 调度台」客户端组件（`components/ai/ai-dispatch-console.tsx`）：批量建档按钮 + 泳道选择 + 运行调度器 + 实时队列健康卡。

### 11.4 P1 冒烟（9/9 通过）
| 用例 | 结果 |
|---|---|
| 入队(fast) → 调度全链路 | 产出 3 条规则提案，任务转 DONE，done +1 |
| 租约过期回收 | RUNNING(attempts<max) → QUEUED |
| 重试超限 | RUNNING(attempts=max) → FAILED |
| 双泳道隔离 | claimDue(lane=fast) 仅领 fast；claimDue(lane=llm) 仅领 llm |
| 跨租户隔离 | 他组织 queued 任务不计入本组织 health |
| REST GET/POST | 健康查询与空轮调度正常返回 |

验证：`tsc --noEmit` 0 错误；`next build` 通过；新路由 `/api/dev/agent-dispatch` 已注册。
| P3 沙箱研究 | 浏览器 Agent 产出的事实仍写入 `AiFact`，闸门与 UI 完全复用 |

## 12. P2-1 问 CRM · 只读查询引擎（已落地 · 2026-09-08）

让业务用户用自然语言问 CRM 数据，答案复用主表 `aiMeta` 溯源，无 LLM Key 也能答（规则引擎兜底）。这是 AI-Native 从「AI 写」走向「AI 答」的关键一步。

### 12.1 设计原则（与 P0/P1 一致）
- 一切查询带 `orgId`，跨租户不可见（调用方 `requireOrg` 保证）
- **只读执行**：引擎绝不写库（仅 `askCrmAction` 落一条 `AgentRun` 审计，agentName=ask-crm）
- **白名单意图**：只跑预定义聚合查询，绝不拼接任意字段 / SQL，防注入与越权
- **答案溯源**：复用 `aiMeta` 标注「哪些是 AI 建档字段」，让 AI 答案可审计
- **降级优先**：无 Key 走规则引擎答总览式提问；有 Key 仅做语言润色（不取数、不编造）

### 12.2 意图集（确定性关键词解析，不依赖模型）
`company_count` / `industry_dist` / `contact_count` / `lead_count` / `opportunity_agg` / `amount_sum` / `followup`(含「临近成交」「需要跟进」) / `top_opportunities` / `ai_enriched` / `unknown`(兜底给示例)。时间窗口：今天 / 本周(周一) / 本月 / 本季度。

### 12.3 文件
| 文件 | 动作 |
|---|---|
| `apps/web/lib/ai/ask-crm.ts` | 新建：parseIntent + 白名单执行器 + 溯源(metaOf) + 可选 LLM 润色(maybeLlmRewrite，原生 fetch OpenAI 兼容，失败降级 rule) |
| `apps/web/lib/actions/askCrm.ts` | 新建：`askCrmAction(slug, question)` 会话鉴权 + 落 AgentRun |
| `apps/web/components/ai/ai-ask-crm.tsx` | 新建：dashboard 客户端查询框 + 示例问题 + 答案/溯源展示 |
| `apps/web/app/w/[slug]/dashboard/page.tsx` | 顶部嵌入 `<AskCrm slug={slug} />` |
| `apps/web/app/api/dev/ask-crm/route.ts` | 新建：POST{orgSlug,question} / GET?orgSlug=&question=（会话无关，与 agent-jobs 同风格） |

### 12.4 验证（全绿）
- `tsc --noEmit` 0 错误；`next build` 通过（新路由 `/api/dev/ask-crm` 已注册）
- REST 冒烟：9 类意图全通；`industry_dist` 正确识别「1 家的行业由 AI 建档补全」（溯源生效）；`followup` 正确返回待处理活动数 + 近 7 天商机；不存在 orgSlug → 404（隔离）；无 Key 走 rule 引擎正常答
- 修复：意图优先级 bug（「临近成交需要跟进」误判 amount_sum），把 followup 正则前置 + amount_sum 去掉裸「成交」

## 13. P2-2 跟进提醒 Agent（已落地 · 2026-09-08）

### 13.1 设计原则（与 P0/P1/P2-1 一致）
- 一切查询带 orgId（跨租户不可见）
- 只读扫描：只产出「提醒」列表，绝不改动任何业务主表
- 提醒落 AgentRun 审计（agentName=followup-reminder），dashboard / dev 看板可溯源
- 复用 P1 租约队列 + 双泳道：提醒任务 kind=`reminder:scan`，fast 泳道确定性执行（不调模型）

### 13.2 数据口径（务实约束）
Activity 模型无 dueDate 字段（仅 happenedAt 实际发生时间），故「逾期」语义不成立。提醒聚焦两类可量化信号：
- A. 商机临期：Opportunity.status=OPEN 且 expectedCloseAt ∈ [now, +7d] → 高优先提醒
- B. 待办未完成：Activity.status=OPEN 且 type=TASK → 待办提醒

### 13.3 执行链路
runReminderScan → enqueueReminderScan(幂等) → dispatchOnce(lane=fast) 立即执行 → 读最新 AgentRun.result.reminders 返回 dashboard。

### 13.4 文件
| 文件 | 说明 |
| --- | --- |
| `apps/web/lib/ai/reminder.ts` | 新建：runReminderScan 扫描引擎（临期商机 + TASK 待办，落 AgentRun） |
| `apps/web/lib/ai/dispatch.ts` | 改：enqueueReminderScan + executeTask 识别 `reminder:` 分支 |
| `apps/web/lib/actions/reminder.ts` | 新建：runReminderScanAction / getRemindersAction（会话鉴权 + 跨租户隔离） |
| `apps/web/app/api/dev/agent-reminder/route.ts` | 新建：POST{orgSlug} 触发 / GET 读最新（会话无关） |
| `apps/web/components/ai/ai-reminders-card.tsx` | 新建：dashboard 提醒卡（运行按钮 + 优先级徽章 + 实体链接） |
| `apps/web/app/w/[slug]/dashboard/page.tsx` | 嵌入 `<AiRemindersCard slug={slug} />`（AskCrm 下方） |

### 13.5 验证（全绿）
- `tsc --noEmit` 0 错误；`next build` 通过（新路由 `/api/dev/agent-reminder` 已注册）
- tsx 冒烟：为 smoke 组织插入临期商机 + TASK 待办 → 幂等 deduped=true、QUEUED=1、picked=1、reminderCount=3（1 高优先 + 2 待办）全绿；清理后 dev.db 无残留
- REST：不存在 orgSlug → 404；真实 org POST 扫描出「准备竞品对比表」待办（`reminderCount=1`）

## 14. P2-3 邮件草稿生成（已落地 · 2026-09-08）

### 14.1 设计原则（与全局一致）
- 一切查询带 orgId（跨租户不可见）
- 只产出草稿：绝不自动发送、绝不改动任何业务主表
- 草稿落 AgentRun 审计（agentName=email-draft），dev 看板可溯源
- 双泳道：fast=纯模板引擎（不调模型）；llm=有 Key 时模型润色，失败自动降级模板

### 14.2 防编造策略
- 模板严格基于主表 + aiMeta 真实字段拼接，缺失字段直接省略，不臆造
- LLM 仅润色：system 明确禁止虚构公司名/数据/人名/案例；输出不回写任何业务字段，仅作草稿正文
- 信息溯源：citations 标注每条用到的信息来自「人工录入」还是「AI 建档补全（band）」

### 14.3 执行链路
runDraftGen → enqueueDraftTask(幂等, kind=`draft:CONTACT|LEAD:<id>`, fast) → dispatchOnce(lane=fast) → 读最新 AgentRun.result(subject/body/citations)。

### 14.4 文件
| 文件 | 说明 |
| --- | --- |
| `apps/web/lib/ai/draft.ts` | 新建：runDraftGen 引擎（loadContext + buildTemplate 规则 + callChat LLM 润色 + 溯源 citations） |
| `apps/web/lib/ai/dispatch.ts` | 改：enqueueDraftTask + executeTask 识别 `draft:` 分支 |
| `apps/web/lib/actions/draft.ts` | 新建：generateDraftAction / listDraftsAction（会话鉴权 + 跨租户隔离） |
| `apps/web/app/api/dev/agent-draft/route.ts` | 新建：POST{orgSlug,targetType,targetId} / GET 读最新（会话无关） |
| `apps/web/components/ai/ai-draft-generator.tsx` | 新建：设置页「邮件草稿生成器」卡片（表单 + 最新草稿 + 历史 20 条） |
| `apps/web/app/w/[slug]/settings/ai/page.tsx` | 嵌入 `<AiDraftGenerator slug={slug} />`（调度台下方） |

### 14.5 验证（全绿）
- `tsc --noEmit` 0 错误；`next build` 通过（新路由 `/api/dev/agent-draft` 已注册）
- tsx 冒烟：构造带 AI 建档 industry(aiMeta.appliedAt) 的 company+contact → 走队列生成 → AgentRun COMPLETED、subject/body 非空、mode=rule、citations 正确标注「行业：智能制造 → AI 建档补全（POSSIBLE）」；不存在目标 ID → loadContext 被 orgId 过滤 → AgentRun FAILED（不泄露他组织数据）；临时数据已清理
- REST：真实 contact POST 200 返回「关于杭州云帆贸易有限公司的跟进与合作建议」(mode=rule, body 245 字)；不存在 orgSlug → 404；测试数据已清理

## 15. P2-4 AgentJob 泛化看板（已落地 · 2026-09-08）

把「多 Agent 编码任务日志」承载的 AgentRun 视角泛化为**统一 AI 动作看板**，覆盖 P0~P2-3 的全部 AI 动作类型，并补齐筛选与溯源。

### 15.1 设计原则（与全局一致）
- 不改写各引擎落库逻辑——溯源线索直接来自 `AgentRun.idempotencyKey` 与 `task.kind`（格式规整、零侵入）
- 跨租户：`where.orgId` 天然隔离；一切查询带 orgId
- 只读审计：看板不触发任何写入、不改动业务数据

### 15.2 看板能力
- **类型筛选 tab**：全部 / 智能建档（company-enrich·lead-enrich）/ 问 CRM（ask-crm）/ 跟进提醒（followup-reminder）/ 邮件草稿（email-draft），等价于 `where.agentName in (...)`
- **类型分布卡**：各动作类型最近运行数（点击直达筛选）
- **结果摘要**：从 `result` Json 提取人类可读摘要（建档 N 条提案 / 邮件主题 / 提醒数 / 问 CRM 答案前 64 字）
- **溯源链接**：从 `idempotencyKey` 解析实体 → 跳转对应 CRM 模块列表页
  - `enrich:COMPANY:<id>` → `/w/[slug]/crm/companies`；`enrich:LEAD:<id>` → `/crm/leads`
  - `draft:CONTACT:<id>` → `/crm/contacts`；`draft:LEAD:<id>` → `/crm/leads`
  - `followup-reminder` → `/dashboard`（跟进提醒卡片）
  - 问 CRM 为查询类，无单一实体，不显示溯源

### 15.3 文件
- 改写 `apps/web/app/w/[slug]/dev/agent-runs/page.tsx`（标题「AI 动作看板」+ 筛选/分布/摘要/溯源，原 EmptyState 文案改为引导触发各 AI 动作）

### 15.4 验证（全绿）
- `tsc --noEmit` 0 错误；`next build` 通过（`/w/[slug]/dev/agent-runs` 已注册，列页路由 `crm/{companies,leads,contacts,opportunities,activities}` 均存在）
- tsx 等价验证：smoke 组织 `AgentRun.groupBy(agentName)` → company-enrich 2 / lead-enrich 1；`where.agentName in enrich[]` → 3 条（筛选等价成立）；溯源正则 `enrich:COMPANY:co_ai_… → crm/companies`、`enrich:LEAD:ld_ai_… → crm/leads` 命中

### 15.5 关键约束
- CRM 模块**无 `[id]` 详情页**（仅列表页），溯源链接落在列表页而非具体实体；如需精确到单条记录，后续补详情页或列表 `?focus=<id>` 深链
- 类型统计基于单页 `take:40` 范围，非全量 count（看板定位为「最近动作」，足够）

## 16. P3 生产化基建（已落地 · 2026-09-08）

把 AI-Native 闭环从「开发 demo」推向「可生产部署」：统一 API 鉴权、PG 切换骨架、E2B 沙箱接入点、git 仓库初始化。

### 16.1 REST API Key 鉴权层（P3-1）
- `lib/api-auth.ts`：`resolveApiOrg(req, fallbackSlug?)` 双模式
  - **生产模式**（配置了 `UCRM_API_KEYS="slug1=key1,slug2=key2"`）：强制 `Authorization: Bearer <key>`，命中映射出组织；无/错 Key → 401，绝不回退 slug 头（防越权）
  - **开发模式**（未配置）：回退 `X-Org-Slug` 头 → 再回退请求体/查询 `orgSlug`（向后兼容历史调用）
- 5 个 `/api/dev/*` 路由统一接入（agent-jobs / ask-crm / agent-dispatch / agent-reminder / agent-draft），删除各自重复的 `findUnique(slug)` 段
- 安全要点：一切结果带 orgId，调用方必须用 orgId 过滤；生产模式 Key 缺失即 401

### 16.2 生产 PG 切换骨架（P3-2）
- 新增 `prisma/schema.postgres.prisma`（`provider="postgresql"`，模型与主 schema 完全一致；类型层面零改动，因建模已遵循「无 enum/数组/citext，状态 String」约定）
- `prisma validate --schema prisma/schema.postgres.prisma` → **valid 🚀**
- 新增 `docs/PROD_PG.md`：切换步骤（设 DATABASE_URL → migrate dev --schema → generate → build）、双 schema 管理约定、adapter 切换提示、上线前验证清单
- 零破坏：sqlite 仍是默认开发 schema，dev 不受影响

### 16.3 E2B 沙箱适配器 stub（P3-3）
- `lib/ai/sandbox.ts`：`runInSandbox(task)` + `persistSandboxFacts(orgId, facts)`
  - 未配置 `E2B_API_KEY` → 返回 disabled 降级说明（不破坏 dev）
  - 已配置 → 预留 `@e2b/sdk` 接入点（取消注释即接 `Sandbox.create`）
  - 沙箱产出经 `AiFact` 闸门写入 PROPOSED（与本地建档引擎同表同闸门，人采纳才落主表），绝不直写业务主表

### 16.4 git 仓库初始化（P3-4）
- `unified-crm` 下 `git init`（本地仓库，未 commit；提交由用户拍板）
- `.gitignore` 已就位且校验生效：`.env` / `packages/db/prisma/dev.db` / `node_modules` / `packages/db/.env` / `.env.local` 全部被忽略，untracked 仅源码/配置
- 误建的根级 `/Users/wangliyan/Documents/crm/.git`（Bash cwd 不持久导致）已清理；原始 `crm/.git`、`nextcrm-app/.git` 未动

### 16.5 验证（全绿）
- `tsc --noEmit` 0 错误；`next build` 通过（P3 接入的 5 路由均注册）
- `prisma validate` PG schema 通过
- API Key 鉴权 tsx 冒烟 7/7：正确 Bearer→apikey / 错误 Key→401 / 生产缺 Key→401 / dev 回退 X-Org-Slug→dev / dev 回退 body slug→dev / 无标识→400 / 不存在 org→404

### 16.6 关键约束
- 生产部署**必须**设 `UCRM_API_KEYS`（否则 REST 仍是 dev 回退模式，存在越权风险）
- E2B 真实启用需 `npm i @e2b/sdk` 并在 `runInSandbox` 内接入（当前为骨架）
- git 提交/push 由用户拍板，本助手不擅自 commit

### 文件清单（P3 新增/改写）
| 文件 | 变更 |
| --- | --- |
| `apps/web/lib/api-auth.ts` | 新建：统一 REST 鉴权 helper |
| `apps/web/app/api/dev/{agent-jobs,ask-crm,agent-dispatch,agent-reminder,agent-draft}/route.ts` | 改写：接入 resolveApiOrg |
| `packages/db/prisma/schema.postgres.prisma` | 新建：PG provider 版 |
| `docs/PROD_PG.md` | 新建：生产 PG 切换指南 |
| `apps/web/lib/ai/sandbox.ts` | 新建：E2B 沙箱适配器 stub |

## 16. 国内大模型对接（千问 / DeepSeek）[AI·NEW]

**诉求**：后端可配置，在通义千问 Qwen、DeepSeek、OpenAI、自定义兼容端点之间切换，无需改代码。

### 16.1 统一客户端 `lib/ai/llm.ts`
- 全部 AI 动作（问 CRM 润色 / 建档 LLM / 邮件草稿润色）**唯一**模型调用入口 `llmChat({system,user,json?,temperature?,timeoutMs?})`
- 核心修复：旧代码在 ask-crm / lead-enrich / draft 三处各自 `fetch`，且 key 用
  `AI_API_KEY || OPENAI || DASHSCOPE || DEEPSEEK` 直接 `||` 拼接 —— 当 provider=deepseek 却设了
  `AI_API_KEY` 时，会把错 key 发到 DeepSeek 端点（必然 401）。现在 `resolveApiKey(caps)` **严格按
  当前 provider 取专属 key**，端点 / 模型 / key 三者一致。
- 任何失败返回 `null` → 调用方降级规则 / 模板引擎，绝不中断主流程；返回 `usage` 供成本统计

### 16.2 后端环境变量切换（capabilities.ts）
| 供应商 | `UCRM_LLM_PROVIDER` | Key 变量 | 默认模型 | 端点 |
| --- | --- | --- | --- | --- |
| 通义千问 Qwen | `qwen`（=`dashscope`） | `DASHSCOPE_API_KEY` | qwen-plus | dashscope.aliyuncs.com/compatible-mode/v1 |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` | deepseek-chat | api.deepseek.com/v1 |
| OpenAI | `openai` | `OPENAI_API_KEY` | gpt-4o-mini | api.openai.com/v1 |
| 自定义 | `custom` | `AI_BASE_URL`+`AI_API_KEY` | `AI_MODEL` | 用户端点 |

- `qwen` 是 `dashscope` 的易记别名；通用兜底 `AI_API_KEY` 可顶替任意专属 key（精度不如专属）
- `AI_MODEL` 覆盖默认模型（如 qwen-max / deepseek-reasoner）
- 无任意 key → 自动降级规则引擎，功能仍可完整演示
- 样例见 `.env.example`（已被 `!.env.example` 显式纳入 git）

### 16.3 配置 UI
- 「设置 → AI 能力」页新增「模型供应商配置」卡：展示当前生效 Provider + 四档切换表 + 兜底变量说明
- 改 `.env` 重启即生效，无需改代码

### 16.4 验证（全绿）
- `tsc --noEmit` 0 错误；`next build` 通过
- tsx 冒烟 **13/13**：qwen 别名归一 dashscope + 用 DASHSCOPE_API_KEY；deepseek 用 DEEPSEEK_API_KEY
  （修复旧 `||` bug）；推断模式仍取专属 key；自定义端点 URL/Model；无 key 降级 `llmChat`→null

## 17. 路线图总览

| 阶段 | 状态 |
| --- | --- |
| P0 证据账本 + 写入闸门 | ✅ |
| P1 租约队列 + 双泳道调度 | ✅ |
| P2-1 问 CRM | ✅ |
| P2-2 跟进提醒 | ✅ |
| P2-3 邮件草稿 | ✅ |
| P2-4 AI 动作看板（agent-runs 泛化） | ✅ |
| P3 REST 换 Key / PG 骨架 / E2B stub / git init | ✅ |
| **国内大模型对接（千问/DeepSeek 可配置）** | ✅ |
| **后续** 生产上线（PG 迁移+adapter 切换 / E2B 真实接入 / CI 部署 / 详情页深链） | 待做 |
