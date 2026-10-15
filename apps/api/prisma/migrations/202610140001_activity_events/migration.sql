-- Per-account activity timeline for administrators. No record contents or financial values are stored here.
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt");
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent"("type", "createdAt");
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");
