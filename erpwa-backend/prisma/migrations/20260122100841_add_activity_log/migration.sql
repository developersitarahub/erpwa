/*
  Warnings:

  - You are about to drop the column `category` on the `WebhookLog` table. All the data in the column will be lost.
  - You are about to drop the column `operation` on the `WebhookLog` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `WebhookLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WebhookLog" DROP COLUMN "category",
DROP COLUMN "operation",
DROP COLUMN "type";

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "phoneNumber" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "event" TEXT,
    "category" TEXT,
    "error" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_vendorId_idx" ON "ActivityLog"("vendorId");

-- CreateIndex
CREATE INDEX "ActivityLog_conversationId_idx" ON "ActivityLog"("conversationId");

-- CreateIndex
CREATE INDEX "ActivityLog_messageId_idx" ON "ActivityLog"("messageId");

-- CreateIndex
CREATE INDEX "ActivityLog_status_idx" ON "ActivityLog"("status");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_type_idx" ON "ActivityLog"("type");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
