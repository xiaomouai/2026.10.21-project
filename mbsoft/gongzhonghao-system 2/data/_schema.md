# 数据表结构定义 · Schema

> 所有 CSV 用 UTF-8 编码，第一行表头。日期格式 `YYYY-MM-DD`。
> 脚本按此 schema 读写，修改字段需同步更新 `scripts/`。

## daily-metrics/YYYY-MM-DD.csv（每日指标，每日一个文件）

```
date, reads, shares, new_followers, ext_clicks,
leads, private_add, valid_talks, deals, gmv,
delivered, nps, refunds, new_feedback,
published_count, cta_clicks, conversion_rate, notes
```

| 字段 | 含义 | 来源 |
|---|---|---|
| date | 日期 | 自动 |
| reads | 阅读量（汇总） | 公众号后台 |
| shares | 分享数 | 后台 |
| new_followers | 新增关注 | 后台 |
| ext_clicks | 外部分发点击 | 各渠道后台 |
| leads | 线索数（加微/表单） | 私域 |
| private_add | 私域新增 | 企微后台 |
| valid_talks | 有效沟通数 | 销售跟进 |
| deals | 成交数 | CRM |
| gmv | 成交金额 | CRM |
| delivered | 交付数 | 交付记录 |
| nps | 净推荐值 0-10 | 回访 |
| refunds | 退款数 | 财务 |
| new_feedback | 新增反馈/需求数 | 销售/客服 |
| published_count | 当日发布篇数 | content-log |
| cta_clicks | CTA 点击数 | 后台/二维码统计 |
| conversion_rate | 线索→成交率 | 计算 |
| notes | 备注（异常标注） | 人工 |

## content-log.csv（内容发布台账）

```
date, title, topic_id, funnel_stage, channels, status, reads, cta_clicks, leads, notes
```

## experiment-log.csv（实验记录台账）

```
id, date, type, hypothesis, variable, metric, target, status, result, notes
```
- `type`：选题 / 投放 / 渠道 / 钩子 / CTA / 产品
- `status`：假设 / 验证有效 / 验证无效 / 待观察

## lead-log.csv（线索台账）

```
date, source, content_id, stage, pain, budget, decision_time, objection, owner, notes
```
- `stage`：新线索 / 已加微 / 有效沟通 / 方案中 / 成交 / 流失

## deal-log.csv（成交台账）

```
date, lead_id, product, amount, source_content, source_channel, rep, notes
```

## 字段命名约定
- 所有表以 `date` 或 `id` 开头，便于排序与关联。
- 外键关联：`lead-log.id` ← `deal-log.lead_id`；`experiment-log.id` ← `content-log.topic_id`。
- 金额统一为人民币元，整数。
