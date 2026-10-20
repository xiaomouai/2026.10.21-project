-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN "costUsd" REAL;
ALTER TABLE "AgentRun" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "AgentRun" ADD COLUMN "outputTokens" INTEGER;

-- CreateTable
CREATE TABLE "AiFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "currentValue" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "band" TEXT NOT NULL,
    "evidence" JSONB,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "reason" TEXT,
    "runId" TEXT,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiFact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiFact_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "industry" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "leadSource" TEXT,
    "ownerUserId" TEXT,
    "note" TEXT,
    "aiStatus" TEXT NOT NULL DEFAULT 'NONE',
    "aiMeta" JSONB,
    "aiEnrichedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Company_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Company_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("address", "createdAt", "email", "id", "industry", "leadSource", "name", "note", "orgId", "ownerUserId", "phone", "status", "updatedAt", "website") SELECT "address", "createdAt", "email", "id", "industry", "leadSource", "name", "note", "orgId", "ownerUserId", "phone", "status", "updatedAt", "website" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE INDEX "Company_orgId_idx" ON "Company"("orgId");
CREATE INDEX "Company_orgId_status_idx" ON "Company"("orgId", "status");
CREATE INDEX "Company_orgId_name_idx" ON "Company"("orgId", "name");
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "ownerUserId" TEXT,
    "note" TEXT,
    "convertedAt" DATETIME,
    "aiStatus" TEXT NOT NULL DEFAULT 'NONE',
    "aiMeta" JSONB,
    "aiEnrichedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("company", "convertedAt", "createdAt", "email", "id", "name", "note", "orgId", "ownerUserId", "phone", "score", "source", "status", "updatedAt") SELECT "company", "convertedAt", "createdAt", "email", "id", "name", "note", "orgId", "ownerUserId", "phone", "score", "source", "status", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_orgId_idx" ON "Lead"("orgId");
CREATE INDEX "Lead_orgId_status_idx" ON "Lead"("orgId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiFact_orgId_entityType_entityId_status_idx" ON "AiFact"("orgId", "entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "AiFact_orgId_status_idx" ON "AiFact"("orgId", "status");

-- CreateIndex
CREATE INDEX "AiFact_runId_idx" ON "AiFact"("runId");
