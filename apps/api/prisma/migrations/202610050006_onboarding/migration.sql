ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
 ADD COLUMN "persona" TEXT,
 ADD COLUMN "focusAreas" JSONB NOT NULL DEFAULT '[]',
 ADD COLUMN "referralSource" TEXT;
