-- Payment webhook deliveries are recorded once per provider event id, so a repeated delivery is acknowledged without being applied twice.
CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookEvent_provider_receivedAt_idx" ON "WebhookEvent"("provider","receivedAt");
-- One free trial per real mailbox: the normalised address (plus-tags and Gmail dots removed) is stored when a trial starts.
ALTER TABLE "User" ADD COLUMN "trialKey" TEXT;
CREATE UNIQUE INDEX "User_trialKey_key" ON "User"("trialKey");
