-- 补齐 Activity 的历史漂移字段
-- ----------------------------------------------------------------------------
-- 现象：schema.prisma 里 Activity 有 sopStage / dueAt，但既有 SQLite 迁移从未
--       建过这两列（本地库此前靠 db push 或手工方式演进），导致全新库执行
--       migrate deploy 后 SOP 自动推进、截止时间提醒全部报 ColumnNotFound。
-- 处理：补齐列与索引。生产（PostgreSQL）走 prisma db push + schema.postgres.prisma，
--       不受本迁移影响，但两处 schema 必须始终保持一致。
ALTER TABLE "Activity" ADD COLUMN "sopStage" TEXT;
ALTER TABLE "Activity" ADD COLUMN "dueAt" DATETIME;

CREATE INDEX "Activity_orgId_status_dueAt_idx" ON "Activity"("orgId", "status", "dueAt");
