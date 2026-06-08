-- Remove SCRATCHED from TradeStatus enum
-- PostgreSQL cannot DROP VALUE directly; recreate the enum without it.
-- SAFETY: This will fail at ALTER COLUMN if any rows have status='SCRATCHED'.
-- Verify zero SCRATCHED trades before deploying to production.
ALTER TYPE "TradeStatus" RENAME TO "TradeStatus_old";
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'MISSED');
ALTER TABLE "Trade" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trade" ALTER COLUMN "status" TYPE "TradeStatus" USING "status"::text::"TradeStatus";
ALTER TABLE "Trade" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "TradeStatus_old";
