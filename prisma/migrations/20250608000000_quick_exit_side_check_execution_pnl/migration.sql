-- AlterEnum
ALTER TYPE "TradeStatus" ADD VALUE 'MISSED';

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "executionPnl" DECIMAL(18,2),
ADD COLUMN     "idealDirection" "Direction",
ADD COLUMN     "idealEntry" DECIMAL(18,6),
ADD COLUMN     "idealExit" DECIMAL(18,6),
ADD COLUMN     "idealStop" DECIMAL(18,6),
ADD COLUMN     "sideCorrect" BOOLEAN;
