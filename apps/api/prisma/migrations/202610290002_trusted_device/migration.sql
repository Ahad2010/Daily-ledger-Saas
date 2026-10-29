-- Remembered sign-in browsers. A new, empty table only.
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");
CREATE INDEX "TrustedDevice_expiresAt_idx" ON "TrustedDevice"("expiresAt");
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
