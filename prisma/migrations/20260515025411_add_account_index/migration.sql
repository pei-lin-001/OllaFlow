/*
  Warnings:

  - You are about to alter the column `evalDuration` on the `UsageRecord` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `loadDuration` on the `UsageRecord` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `promptEvalDuration` on the `UsageRecord` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `totalDuration` on the `UsageRecord` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UsageRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER,
    "proxyUserId" INTEGER,
    "model" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "promptEvalCount" INTEGER,
    "evalCount" INTEGER,
    "totalDuration" BIGINT,
    "loadDuration" BIGINT,
    "promptEvalDuration" BIGINT,
    "evalDuration" BIGINT,
    "statusCode" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "streamed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UsageRecord_proxyUserId_fkey" FOREIGN KEY ("proxyUserId") REFERENCES "ProxyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UsageRecord" ("accountId", "createdAt", "endpoint", "errorMessage", "evalCount", "evalDuration", "id", "loadDuration", "model", "promptEvalCount", "promptEvalDuration", "proxyUserId", "statusCode", "streamed", "totalDuration") SELECT "accountId", "createdAt", "endpoint", "errorMessage", "evalCount", "evalDuration", "id", "loadDuration", "model", "promptEvalCount", "promptEvalDuration", "proxyUserId", "statusCode", "streamed", "totalDuration" FROM "UsageRecord";
DROP TABLE "UsageRecord";
ALTER TABLE "new_UsageRecord" RENAME TO "UsageRecord";
CREATE INDEX "UsageRecord_accountId_createdAt_idx" ON "UsageRecord"("accountId", "createdAt");
CREATE INDEX "UsageRecord_proxyUserId_createdAt_idx" ON "UsageRecord"("proxyUserId", "createdAt");
CREATE INDEX "UsageRecord_model_createdAt_idx" ON "UsageRecord"("model", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Account_isActive_disabledAt_idx" ON "Account"("isActive", "disabledAt");
