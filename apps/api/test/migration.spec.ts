import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Initial domain migration", () => {
  const migrationsRoot = join(process.cwd(), "prisma", "migrations");
  const migration = [
    "20260813000000_initial_domain",
    "20260813010000_auth_rate_limits",
    "20260813020000_audit_logs",
  ]
    .map((directory) =>
      readFileSync(join(migrationsRoot, directory, "migration.sql"), "utf8"),
    )
    .join("\n");

  it.each([
    "users_email_normalized_check",
    "bookmaker_accounts_balance_check",
    "wallet_transactions_amount_check",
    "operations_settlement_check",
    "bet_legs_credit_reference_check",
    "bet_credits_consumption_check",
    "auth_rate_limits_attempts_check",
  ])("contains database constraint %s", (constraint) => {
    expect(migration).toContain(`CONSTRAINT "${constraint}"`);
  });

  it("uses restrictive foreign keys for financial records", () => {
    expect(migration).toMatch(
      /wallet_transactions_operation_id_fkey[\s\S]+ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(
      /bet_credits_source_operation_id_fkey[\s\S]+ON DELETE RESTRICT/,
    );
    expect(migration).toContain("audit_logs_user_id_fkey");
  });

  it("removes the legacy constraint that rejected free bet credits", () => {
    const correction = readFileSync(
      join(
        migrationsRoot,
        "20260813080000_remove_legacy_credit_constraint",
        "migration.sql",
      ),
      "utf8",
    );
    expect(correction).toContain(
      'DROP CONSTRAINT IF EXISTS "bet_legs_credit_reference_check"',
    );
  });

  it("backfills existing legs as Back with stake equal to risk amount", () => {
    const layMigration = readFileSync(
      join(migrationsRoot, "20260815100000_add_lay_bets", "migration.sql"),
      "utf8",
    );
    expect(layMigration).toContain('CREATE TYPE "BetType"');
    expect(layMigration).toContain('SET "risk_amount" = "stake"');
    expect(layMigration).toContain('ALTER COLUMN "risk_amount" SET NOT NULL');
  });
});
