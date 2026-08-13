ALTER TABLE "bet_legs"
ADD COLUMN "uses_free_bet_credit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "bet_legs"
ADD CONSTRAINT "bet_legs_credit_source_check"
CHECK (
  ("uses_bet_credit" = false AND "uses_free_bet_credit" = false AND "bet_credit_id" IS NULL)
  OR
  ("uses_bet_credit" = true AND "uses_free_bet_credit" = true AND "bet_credit_id" IS NULL)
  OR
  ("uses_bet_credit" = true AND "uses_free_bet_credit" = false AND "bet_credit_id" IS NOT NULL)
);
