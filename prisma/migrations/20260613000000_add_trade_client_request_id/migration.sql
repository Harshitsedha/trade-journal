-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trade_clientRequestId_key" ON "Trade"("clientRequestId");
