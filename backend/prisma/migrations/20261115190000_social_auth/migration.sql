CREATE TABLE "OAuthIdentity" ("id" TEXT NOT NULL, "provider" TEXT NOT NULL, "subject" TEXT NOT NULL, "userId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OAuthIdentity_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "OAuthIdentity_provider_subject_key" ON "OAuthIdentity"("provider","subject");
CREATE INDEX "OAuthIdentity_userId_idx" ON "OAuthIdentity"("userId");
ALTER TABLE "OAuthIdentity" ADD CONSTRAINT "OAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "OAuthFlow" ("stateHash" TEXT NOT NULL, "provider" TEXT NOT NULL, "role" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OAuthFlow_pkey" PRIMARY KEY ("stateHash"));
CREATE TABLE "OAuthTicket" ("ticketHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OAuthTicket_pkey" PRIMARY KEY ("ticketHash"));
