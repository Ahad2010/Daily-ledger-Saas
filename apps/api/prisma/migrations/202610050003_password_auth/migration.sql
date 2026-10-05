ALTER TABLE "User" ALTER COLUMN "googleId" DROP NOT NULL;
CREATE TABLE "PasswordCredential" (
  id TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  email TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasswordCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PasswordCredential_userId_key" ON "PasswordCredential"("userId");
CREATE UNIQUE INDEX "PasswordCredential_email_key" ON "PasswordCredential"(email);
CREATE TABLE "PasswordReset" (
  id TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PasswordReset_userId_expiresAt_idx" ON "PasswordReset"("userId","expiresAt");
