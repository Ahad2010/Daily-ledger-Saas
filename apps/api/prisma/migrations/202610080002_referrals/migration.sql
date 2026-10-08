ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
ALTER TABLE "AuthChallenge" ADD COLUMN "referralCode" TEXT;
CREATE TABLE "Referral" (
 "id" TEXT NOT NULL, "referrerId" TEXT NOT NULL, "inviteeId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Referral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Referral_different_accounts" CHECK ("referrerId" <> "inviteeId")
);
CREATE UNIQUE INDEX "Referral_inviteeId_key" ON "Referral"("inviteeId");
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");
