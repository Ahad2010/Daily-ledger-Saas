-- One free Pro trial per account, profile photo (Cloudinary) and payment receipt details.
ALTER TABLE "User" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarPublicId" TEXT;
ALTER TABLE "BillingRecord" ADD COLUMN "receiptUrl" TEXT;
ALTER TABLE "BillingRecord" ADD COLUMN "description" TEXT;
