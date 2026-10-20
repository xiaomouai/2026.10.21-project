CREATE TABLE "SalesOkr" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL NOT NULL DEFAULT 0,
    "targetCompanies" INTEGER NOT NULL DEFAULT 0,
    "targetLeads" INTEGER NOT NULL DEFAULT 0,
    "targetOpportunities" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOkr_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesOkr_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SalesOkr_orgId_status_idx" ON "SalesOkr"("orgId", "status");
CREATE INDEX "SalesOkr_orgId_startDate_endDate_idx" ON "SalesOkr"("orgId", "startDate", "endDate");
