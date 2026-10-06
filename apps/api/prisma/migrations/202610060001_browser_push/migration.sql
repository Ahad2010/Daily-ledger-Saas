CREATE TABLE "PushSubscription" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "endpoint" TEXT NOT NULL UNIQUE,
 "p256dh" TEXT NOT NULL,
 "auth" TEXT NOT NULL,
 "reminders" BOOLEAN NOT NULL DEFAULT true,
 "announcements" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
ALTER TABLE "Job" ADD COLUMN "payload" JSONB NOT NULL DEFAULT '{}';
