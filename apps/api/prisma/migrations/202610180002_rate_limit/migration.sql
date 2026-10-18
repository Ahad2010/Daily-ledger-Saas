-- Shared request counters, so rate limits hold across several API replicas. Rows expire on their own.
CREATE TABLE "RateLimitHit" (
  "key" TEXT NOT NULL,
  "hits" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimitHit_resetAt_idx" ON "RateLimitHit"("resetAt");
