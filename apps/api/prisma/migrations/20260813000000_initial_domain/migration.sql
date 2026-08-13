-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "BookmakerAccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('INITIAL_BALANCE', 'DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_RETURN', 'BET_REFUND', 'BONUS_RECEIVED', 'BONUS_USED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('SUREBET');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('OPEN', 'WAITING_CREDIT_USE', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BetLegResult" AS ENUM ('PENDING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "BetCreditStatus" AS ENUM ('EXPECTED', 'AVAILABLE', 'NOT_GRANTED', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "cpf_hash" VARCHAR(64) NOT NULL,
    "cpf_encrypted" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmaker_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "nickname" VARCHAR(120),
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "BookmakerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "cached_balance" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookmaker_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bookmaker_account_id" UUID NOT NULL,
    "operation_id" UUID,
    "leg_id" UUID,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "type" "OperationType" NOT NULL DEFAULT 'SUREBET',
    "event_name" VARCHAR(240) NOT NULL,
    "notes" TEXT,
    "status" "OperationStatus" NOT NULL DEFAULT 'OPEN',
    "generates_bet_credit" BOOLEAN NOT NULL DEFAULT false,
    "real_cash_investment" DECIMAL(19,2) NOT NULL,
    "promotional_stake" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "protected_return" DECIMAL(19,2) NOT NULL,
    "projected_profit" DECIMAL(19,2) NOT NULL,
    "projected_roi_percent" DECIMAL(19,6) NOT NULL,
    "realized_return" DECIMAL(19,2),
    "realized_profit" DECIMAL(19,2),
    "realized_roi_percent" DECIMAL(19,6),
    "engine_version" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_legs" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "bookmaker_account_id" UUID NOT NULL,
    "bet_credit_id" UUID,
    "position" INTEGER NOT NULL,
    "stake" DECIMAL(19,2) NOT NULL,
    "odd" DECIMAL(19,6) NOT NULL,
    "commission_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "cashback_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "increase_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "uses_bet_credit" BOOLEAN NOT NULL DEFAULT false,
    "result" "BetLegResult" NOT NULL DEFAULT 'PENDING',
    "profit_factor" DECIMAL(19,6) NOT NULL,
    "effective_odd" DECIMAL(19,6) NOT NULL,
    "projected_payout" DECIMAL(19,2) NOT NULL,
    "scenario_result" DECIMAL(19,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bet_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_credits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "consumer_operation_id" UUID,
    "expected_amount" DECIMAL(19,2) NOT NULL,
    "granted_amount" DECIMAL(19,2),
    "status" "BetCreditStatus" NOT NULL DEFAULT 'EXPECTED',
    "consumed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bet_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_hash_key" ON "users"("cpf_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "bookmaker_accounts_user_id_status_idx" ON "bookmaker_accounts"("user_id", "status");

-- CreateIndex
CREATE INDEX "wallet_transactions_bookmaker_account_id_occurred_at_idx" ON "wallet_transactions"("bookmaker_account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_operation_id_idx" ON "wallet_transactions"("operation_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_leg_id_idx" ON "wallet_transactions"("leg_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_user_id_idempotency_key_key" ON "wallet_transactions"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "operations_user_id_status_created_at_idx" ON "operations"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "operations_user_id_settled_at_idx" ON "operations"("user_id", "settled_at");

-- CreateIndex
CREATE UNIQUE INDEX "operations_user_id_sequence_number_key" ON "operations"("user_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "bet_legs_bet_credit_id_key" ON "bet_legs"("bet_credit_id");

-- CreateIndex
CREATE INDEX "bet_legs_bookmaker_account_id_idx" ON "bet_legs"("bookmaker_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "bet_legs_operation_id_position_key" ON "bet_legs"("operation_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "bet_credits_source_operation_id_key" ON "bet_credits"("source_operation_id");

-- CreateIndex
CREATE INDEX "bet_credits_user_id_status_idx" ON "bet_credits"("user_id", "status");

-- CreateIndex
CREATE INDEX "bet_credits_consumer_operation_id_idx" ON "bet_credits"("consumer_operation_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmaker_accounts" ADD CONSTRAINT "bookmaker_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_bookmaker_account_id_fkey" FOREIGN KEY ("bookmaker_account_id") REFERENCES "bookmaker_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "bet_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_bookmaker_account_id_fkey" FOREIGN KEY ("bookmaker_account_id") REFERENCES "bookmaker_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_bet_credit_id_fkey" FOREIGN KEY ("bet_credit_id") REFERENCES "bet_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_credits" ADD CONSTRAINT "bet_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_credits" ADD CONSTRAINT "bet_credits_source_operation_id_fkey" FOREIGN KEY ("source_operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet_credits" ADD CONSTRAINT "bet_credits_consumer_operation_id_fkey" FOREIGN KEY ("consumer_operation_id") REFERENCES "operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks not expressible in the Prisma schema.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check"
  CHECK ("email" = lower(btrim("email")) AND length("email") > 3);

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_expiration_check"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_expiration_check"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "bookmaker_accounts"
  ADD CONSTRAINT "bookmaker_accounts_balance_check"
  CHECK ("cached_balance" >= 0),
  ADD CONSTRAINT "bookmaker_accounts_version_check"
  CHECK ("version" > 0),
  ADD CONSTRAINT "bookmaker_accounts_currency_check"
  CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_amount_check"
  CHECK ("amount" <> 0 OR "type" = 'INITIAL_BALANCE');

ALTER TABLE "operations"
  ADD CONSTRAINT "operations_sequence_check"
  CHECK ("sequence_number" > 0),
  ADD CONSTRAINT "operations_version_check"
  CHECK ("version" > 0),
  ADD CONSTRAINT "operations_investment_check"
  CHECK ("real_cash_investment" >= 0 AND "promotional_stake" >= 0),
  ADD CONSTRAINT "operations_returns_check"
  CHECK (
    "protected_return" >= 0
    AND ("realized_return" IS NULL OR "realized_return" >= 0)
  ),
  ADD CONSTRAINT "operations_settlement_check"
  CHECK (
    ("status" = 'SETTLED' AND "settled_at" IS NOT NULL)
    OR ("status" <> 'SETTLED' AND "settled_at" IS NULL)
  );

ALTER TABLE "bet_legs"
  ADD CONSTRAINT "bet_legs_position_check"
  CHECK ("position" >= 0),
  ADD CONSTRAINT "bet_legs_stake_check"
  CHECK ("stake" > 0),
  ADD CONSTRAINT "bet_legs_odd_check"
  CHECK ("odd" > 1),
  ADD CONSTRAINT "bet_legs_percentages_check"
  CHECK (
    "commission_percent" >= 0 AND "commission_percent" <= 100
    AND "cashback_percent" >= 0
    AND "increase_percent" >= 0
  ),
  ADD CONSTRAINT "bet_legs_calculation_check"
  CHECK (
    "profit_factor" >= 0
    AND "effective_odd" > 1
    AND "projected_payout" >= 0
  ),
  ADD CONSTRAINT "bet_legs_credit_reference_check"
  CHECK (
    ("uses_bet_credit" = true AND "bet_credit_id" IS NOT NULL)
    OR ("uses_bet_credit" = false AND "bet_credit_id" IS NULL)
  );

ALTER TABLE "bet_credits"
  ADD CONSTRAINT "bet_credits_amount_check"
  CHECK (
    "expected_amount" > 0
    AND ("granted_amount" IS NULL OR "granted_amount" > 0)
  ),
  ADD CONSTRAINT "bet_credits_grant_check"
  CHECK (
    "status" NOT IN ('AVAILABLE', 'CONSUMED')
    OR "granted_amount" IS NOT NULL
  ),
  ADD CONSTRAINT "bet_credits_consumption_check"
  CHECK (
    ("status" = 'CONSUMED' AND "consumer_operation_id" IS NOT NULL AND "consumed_at" IS NOT NULL)
    OR ("status" <> 'CONSUMED' AND "consumed_at" IS NULL)
  ),
  ADD CONSTRAINT "bet_credits_distinct_operations_check"
  CHECK ("consumer_operation_id" IS NULL OR "consumer_operation_id" <> "source_operation_id");
