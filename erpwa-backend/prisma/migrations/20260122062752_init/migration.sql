-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "eventType" TEXT NOT NULL,
    "direction" TEXT,
    "phoneNumber" TEXT,
    "messageId" TEXT,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responseCode" INTEGER,
    "errorMessage" TEXT,
    "processingMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookLog_vendorId_idx" ON "WebhookLog"("vendorId");

-- CreateIndex
CREATE INDEX "WebhookLog_eventType_idx" ON "WebhookLog"("eventType");

-- CreateIndex
CREATE INDEX "WebhookLog_status_idx" ON "WebhookLog"("status");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");
