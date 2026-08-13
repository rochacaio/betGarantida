-- The original constraint required every promotional stake to reference a
-- generated credit. Free credits intentionally have no bet_credit_id, and are
-- fully validated by bet_legs_credit_source_check.
ALTER TABLE "bet_legs"
DROP CONSTRAINT IF EXISTS "bet_legs_credit_reference_check";
