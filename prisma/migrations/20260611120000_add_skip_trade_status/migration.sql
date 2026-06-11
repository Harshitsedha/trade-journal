-- Add SKIP to TradeStatus enum.
-- PostgreSQL cannot append an enum value and use it transactionally in one step,
-- so we recreate the enum following the repo convention established in
-- 20250608140000_remove_scratched_status (DROP DEFAULT -> ALTER TYPE -> SET DEFAULT).
-- This is non-destructive: every existing status value is preserved.
ALTER TYPE "TradeStatus" RENAME TO "TradeStatus_old";
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'MISSED', 'SKIP');
ALTER TABLE "Trade" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trade" ALTER COLUMN "status" TYPE "TradeStatus" USING "status"::text::"TradeStatus";
ALTER TABLE "Trade" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "TradeStatus_old";
