-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('STANDARD', 'ORB');

-- CreateEnum
CREATE TYPE "OrbDirection" AS ENUM ('ORIGINAL', 'ANTI');

-- AlterTable
ALTER TABLE "Setup" ADD COLUMN     "strategyType" "StrategyType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "entryRuleCorrect" BOOLEAN;

-- AlterTable
ALTER TABLE "TriggerRule" ADD COLUMN     "orbDirection" "OrbDirection";
