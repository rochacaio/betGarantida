ALTER TYPE "WalletTransactionType" ADD VALUE 'RESERVED_OUT';
ALTER TYPE "WalletTransactionType" ADD VALUE 'RESERVED_IN';

CREATE TYPE "ReservedBalanceTransactionType" AS ENUM (
  'FROM_BOOKMAKER',
  'TO_BOOKMAKER'
);

CREATE TABLE "reserved_balance_transactions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "bookmaker_account_id" UUID NOT NULL,
  "type" "ReservedBalanceTransactionType" NOT NULL,
  "amount" DECIMAL(19,2) NOT NULL,
  "idempotency_key" VARCHAR(160) NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reserved_balance_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reserved_balance_transactions_amount_check" CHECK ("amount" <> 0),
  CONSTRAINT "reserved_balance_transactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reserved_balance_transactions_bookmaker_account_id_fkey"
    FOREIGN KEY ("bookmaker_account_id") REFERENCES "bookmaker_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reserved_balance_transactions_user_id_idempotency_key_key"
ON "reserved_balance_transactions"("user_id", "idempotency_key");

CREATE INDEX "reserved_balance_transactions_user_id_occurred_at_idx"
ON "reserved_balance_transactions"("user_id", "occurred_at");

CREATE INDEX "reserved_balance_bookmaker_occurred_idx"
ON "reserved_balance_transactions"("bookmaker_account_id", "occurred_at");
