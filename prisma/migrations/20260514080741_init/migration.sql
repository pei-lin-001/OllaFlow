-- CreateTable
CREATE TABLE "AdminUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProxyUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "proxyUrl" TEXT,
    "proxyAuth" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "proxyUserId" INTEGER,
    "model" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "promptEvalCount" INTEGER,
    "evalCount" INTEGER,
    "totalDuration" INTEGER,
    "loadDuration" INTEGER,
    "promptEvalDuration" INTEGER,
    "evalDuration" INTEGER,
    "statusCode" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "streamed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsageRecord_proxyUserId_fkey" FOREIGN KEY ("proxyUserId") REFERENCES "ProxyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageAggregate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER,
    "proxyUserId" INTEGER,
    "model" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalDuration" BIGINT NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER,
    "proxyUserId" INTEGER,
    "model" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestBody" TEXT,
    "responseBody" TEXT,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RequestLog_proxyUserId_fkey" FOREIGN KEY ("proxyUserId") REFERENCES "ProxyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ProxyUser_apiKey_key" ON "ProxyUser"("apiKey");

-- CreateIndex
CREATE INDEX "UsageRecord_accountId_createdAt_idx" ON "UsageRecord"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_proxyUserId_createdAt_idx" ON "UsageRecord"("proxyUserId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_model_createdAt_idx" ON "UsageRecord"("model", "createdAt");

-- CreateIndex
CREATE INDEX "UsageAggregate_periodStart_idx" ON "UsageAggregate"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "UsageAggregate_accountId_proxyUserId_model_period_periodStart_key" ON "UsageAggregate"("accountId", "proxyUserId", "model", "period", "periodStart");

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_accountId_createdAt_idx" ON "RequestLog"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_proxyUserId_createdAt_idx" ON "RequestLog"("proxyUserId", "createdAt");
