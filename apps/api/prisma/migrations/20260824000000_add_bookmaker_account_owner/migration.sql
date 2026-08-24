ALTER TABLE "bookmaker_accounts"
ADD COLUMN "owner_name" VARCHAR(120);

CREATE INDEX "bookmaker_accounts_user_id_owner_name_status_idx"
ON "bookmaker_accounts"("user_id", "owner_name", "status");
