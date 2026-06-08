-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('FUTURES', 'OPTIONS', 'EQUITY');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'SCRATCHED');

-- CreateEnum
CREATE TYPE "RuleBreakType" AS ENUM ('EARLY_EXIT', 'LATE_EXIT', 'MOVED_STOP', 'OVERSIZED', 'REVENGE_TRADE', 'OTHER');

-- CreateEnum
CREATE TYPE "TriggerDirection" AS ENUM ('LONG', 'SHORT', 'BOTH');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT,
    "pdfCloudinaryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubSetup" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- NOTE: no idealExit/executionPnl/sideCorrect here — migration 2 adds them
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "expiry" TIMESTAMP(3),
    "setupId" TEXT NOT NULL,
    "subSetupId" TEXT,
    "direction" "Direction" NOT NULL,
    "entryPrice" DECIMAL(18,6) NOT NULL,
    "stopLoss" DECIMAL(18,6) NOT NULL,
    "targets" DECIMAL(65,30)[],
    "exitPrice" DECIMAL(18,6),
    "quantity" DECIMAL(18,4) NOT NULL,
    "riskAmount" DECIMAL(18,2) NOT NULL,
    "rMultiple" DECIMAL(8,2),
    "pnl" DECIMAL(18,2),
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "thesis" TEXT,
    "notes" TEXT,
    "tradeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartImage" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "cloudinaryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleBreak" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "breakType" "RuleBreakType" NOT NULL,
    "ruleDescription" TEXT NOT NULL,
    "actualExitPrice" DECIMAL(18,6) NOT NULL,
    "ruleExitPrice" DECIMAL(18,6),
    "pnlImpact" DECIMAL(18,2) NOT NULL,
    "rMultipleImpact" DECIMAL(8,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerRule" (
    "id" TEXT NOT NULL,
    "setupId" TEXT NOT NULL,
    "precedence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "direction" "TriggerDirection" NOT NULL DEFAULT 'BOTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriggerRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeTrigger" (
    "tradeId" TEXT NOT NULL,
    "triggerRuleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TradeTrigger_pkey" PRIMARY KEY ("tradeId","triggerRuleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Setup_name_key" ON "Setup"("name");

-- CreateIndex
CREATE INDEX "SubSetup_setupId_idx" ON "SubSetup"("setupId");

-- CreateIndex
CREATE UNIQUE INDEX "SubSetup_setupId_name_key" ON "SubSetup"("setupId", "name");

-- CreateIndex
CREATE INDEX "Trade_tradeDate_idx" ON "Trade"("tradeDate");

-- CreateIndex
CREATE INDEX "Trade_setupId_idx" ON "Trade"("setupId");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_assetClass_idx" ON "Trade"("assetClass");

-- CreateIndex
CREATE UNIQUE INDEX "RuleBreak_tradeId_key" ON "RuleBreak"("tradeId");

-- CreateIndex
CREATE INDEX "TriggerRule_setupId_idx" ON "TriggerRule"("setupId");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRule_setupId_precedence_key" ON "TriggerRule"("setupId", "precedence");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSetup" ADD CONSTRAINT "SubSetup_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_subSetupId_fkey" FOREIGN KEY ("subSetupId") REFERENCES "SubSetup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartImage" ADD CONSTRAINT "ChartImage_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleBreak" ADD CONSTRAINT "RuleBreak_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRule" ADD CONSTRAINT "TriggerRule_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeTrigger" ADD CONSTRAINT "TradeTrigger_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeTrigger" ADD CONSTRAINT "TradeTrigger_triggerRuleId_fkey" FOREIGN KEY ("triggerRuleId") REFERENCES "TriggerRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
