-- Activity 增加「计划时间」字段（提醒中心按计划时间/截止时间判断到期与逾期）
ALTER TABLE "Activity" ADD COLUMN "plannedAt" DATETIME;

CREATE INDEX "Activity_orgId_status_plannedAt_idx" ON "Activity"("orgId", "status", "plannedAt");
