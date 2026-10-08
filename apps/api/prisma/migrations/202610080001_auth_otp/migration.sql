CREATE TABLE "AuthChallenge" (
 "id" TEXT NOT NULL, "email" TEXT NOT NULL, "purpose" TEXT NOT NULL,
 "name" TEXT, "passwordHash" TEXT, "codeHash" TEXT NOT NULL, "proofHash" TEXT,
 "returnTo" TEXT NOT NULL DEFAULT '/', "attempts" INTEGER NOT NULL DEFAULT 0,
 "expiresAt" TIMESTAMP(3) NOT NULL, "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "verifiedAt" TIMESTAMP(3), "usedAt" TIMESTAMP(3),
 CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthChallenge_email_purpose_key" ON "AuthChallenge"("email","purpose");
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");
