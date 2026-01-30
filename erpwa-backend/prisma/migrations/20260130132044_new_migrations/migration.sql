-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "whatsappBusinessId" TEXT,
ADD COLUMN     "whatsappPhoneNumberId" TEXT;

-- CreateIndex
CREATE INDEX "ActivityLog_whatsappBusinessId_idx" ON "ActivityLog"("whatsappBusinessId");

-- CreateIndex
CREATE INDEX "ActivityLog_whatsappPhoneNumberId_idx" ON "ActivityLog"("whatsappPhoneNumberId");
