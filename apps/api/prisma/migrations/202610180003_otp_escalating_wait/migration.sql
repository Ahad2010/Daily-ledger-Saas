-- How many codes were sent to this email recently, so each further request waits longer (the wait is per email, not per IP address).
ALTER TABLE "AuthChallenge" ADD COLUMN "sends" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AuthChallenge" ADD COLUMN "sendsSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
