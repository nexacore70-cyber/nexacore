-- Preserve existing roles. New accounts have NULL role until onboarding.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingChoices" JSONB;
-- Existing non-admin users must confirm their choices; admins keep their access.
UPDATE "users" SET "onboardingCompletedAt" = NOW() WHERE "role" = 'ADMIN' AND "onboardingCompletedAt" IS NULL;
