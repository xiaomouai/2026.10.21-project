-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lane" TEXT NOT NULL DEFAULT 'fast',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "leaseOwner" TEXT,
    "leasedUntil" DATETIME,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "scheduledFor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentTask_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentTask" ("createdAt", "error", "id", "input", "kind", "orgId", "output", "priority", "scheduledFor", "status", "updatedAt") SELECT "createdAt", "error", "id", "input", "kind", "orgId", "output", "priority", "scheduledFor", "status", "updatedAt" FROM "AgentTask";
DROP TABLE "AgentTask";
ALTER TABLE "new_AgentTask" RENAME TO "AgentTask";
CREATE INDEX "AgentTask_orgId_status_idx" ON "AgentTask"("orgId", "status");
CREATE INDEX "AgentTask_orgId_kind_idx" ON "AgentTask"("orgId", "kind");
CREATE INDEX "AgentTask_status_lane_scheduledFor_priority_idx" ON "AgentTask"("status", "lane", "scheduledFor", "priority");
CREATE INDEX "AgentTask_status_leasedUntil_idx" ON "AgentTask"("status", "leasedUntil");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
