-- ─────────────────────────────────────────────────────────────────────────────
-- CONSOLIDATED TASK-2 MIGRATION — FOR PRODUCTION ONLY (ep-noisy-brook-aotot7c1)
--
-- Prod has seen NONE of Task 2. The test branch applied three separate migrations
-- (20260613100000_add_instrument_model, 20260614000000_add_trade_pnl_override,
-- 20260614100000_add_instrument_currency). This file is the single atomic
-- equivalent, generated via:
--   prisma migrate diff --from-config-datasource (PROD, read-only) --to-schema --script
-- so prod applies ONE transactional migration instead of three.
--
-- NOT placed under prisma/migrations/ on purpose: that folder is shared with the
-- test branch (which already recorded the three migrations), and `migrate deploy`
-- would otherwise try to re-apply them.
--
-- PROD APPLY PROCEDURE (do NOT run until explicitly approved):
--   1. Back up prod.
--   2. Apply this file in one transaction (psql -1 / BEGIN…COMMIT).
--   3. Mark the three migrations as applied so the shared history stays consistent
--      and future `migrate deploy` skips them:
--        prisma migrate resolve --applied 20260613100000_add_instrument_model
--        prisma migrate resolve --applied 20260614000000_add_trade_pnl_override
--        prisma migrate resolve --applied 20260614100000_add_instrument_currency
--   4. Then run the backfill (separately) and verify.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "instrumentId" TEXT,
ADD COLUMN     "pnlOverride" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "factorOp" TEXT NOT NULL DEFAULT 'MULTIPLY',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_symbol_key" ON "Instrument"("symbol");

-- CreateIndex
CREATE INDEX "Trade_instrumentId_idx" ON "Trade"("instrumentId");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
