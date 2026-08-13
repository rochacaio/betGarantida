-- CreateEnum
CREATE TYPE "AuthRateLimitAction" AS ENUM ('LOGIN', 'PASSWORD_RECOVERY', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" UUID NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "action" "AuthRateLimitAction" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "blocked_until" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_rate_limits_attempts_check" CHECK ("attempts" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_rate_limits_key_hash_action_key" ON "auth_rate_limits"("key_hash", "action");

-- CreateIndex
CREATE INDEX "auth_rate_limits_blocked_until_idx" ON "auth_rate_limits"("blocked_until");
