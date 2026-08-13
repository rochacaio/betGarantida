ALTER TABLE "wallet_transactions"
DROP CONSTRAINT "wallet_transactions_leg_id_fkey";

ALTER TABLE "wallet_transactions"
ADD CONSTRAINT "wallet_transactions_leg_id_fkey"
FOREIGN KEY ("leg_id") REFERENCES "bet_legs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
