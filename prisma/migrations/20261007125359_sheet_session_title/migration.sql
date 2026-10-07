-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "spreadsheetTitle" TEXT;

-- CreateIndex
CREATE INDEX "ChatSession_userId_spreadsheetId_idx" ON "ChatSession"("userId", "spreadsheetId");
