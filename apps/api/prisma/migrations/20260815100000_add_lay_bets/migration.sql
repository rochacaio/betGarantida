CREATE TYPE "BetType" AS ENUM ('BACK', 'LAY');

ALTER TABLE "bet_legs"
  ADD COLUMN "bet_type" "BetType" NOT NULL DEFAULT 'BACK',
  ADD COLUMN "risk_amount" DECIMAL(19, 2);

UPDATE "bet_legs"
SET "risk_amount" = "stake";

ALTER TABLE "bet_legs"
  ALTER COLUMN "risk_amount" SET NOT NULL;
