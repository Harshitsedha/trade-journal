-- Drop idealEntry, idealStop, idealDirection — superseded by simplified model
-- idealExit, sideCorrect, executionPnl are kept

ALTER TABLE "Trade" DROP COLUMN IF EXISTS "idealEntry";
ALTER TABLE "Trade" DROP COLUMN IF EXISTS "idealStop";
ALTER TABLE "Trade" DROP COLUMN IF EXISTS "idealDirection";
