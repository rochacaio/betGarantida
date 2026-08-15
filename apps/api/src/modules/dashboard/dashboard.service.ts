import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

interface SummaryRow {
  profit: Prisma.Decimal;
  loss: Prisma.Decimal;
  net: Prisma.Decimal;
  investment: Prisma.Decimal;
  settled: bigint;
  definitive_loss: Prisma.Decimal;
  credit_source_loss: Prisma.Decimal;
  credit_conversion_profit: Prisma.Decimal;
  contributed_capital: Prisma.Decimal;
  free_winnings: Prisma.Decimal;
}
interface DailyRow {
  day: string;
  result: Prisma.Decimal;
}
interface BalanceRow {
  id: string;
  name: string;
  available: Prisma.Decimal;
  open_stake: Prisma.Decimal;
  monthly_result: Prisma.Decimal;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async monthly(userId: string, month: string) {
    const [summaryRows, dailyRows, balanceRows, recent] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN o."realized_profit" > 0 THEN o."realized_profit" ELSE 0 END), 0)::numeric AS profit,
          ABS(COALESCE(SUM(CASE WHEN o."realized_profit" < 0 THEN o."realized_profit" ELSE 0 END), 0))::numeric AS loss,
          COALESCE(SUM(o."realized_profit"), 0)::numeric AS net,
          COALESCE(SUM(o."real_cash_investment"), 0)::numeric AS investment,
          COUNT(*)::bigint AS settled,
          ABS(COALESCE(SUM(CASE
            WHEN o."realized_profit" < 0 AND (
              o."generates_bet_credit" = false
              OR c."status" IN ('NOT_GRANTED', 'EXPIRED')
            ) THEN o."realized_profit"
            ELSE 0
          END), 0))::numeric AS definitive_loss,
          COALESCE((
            SELECT ABS(SUM(source."realized_profit"))
            FROM "bet_credits" credit
            JOIN "operations" source ON source."id" = credit."source_operation_id"
            WHERE credit."user_id" = ${userId}::uuid
              AND credit."status" IN ('AVAILABLE', 'CONSUMED')
              AND source."realized_profit" < 0
              AND to_char(COALESCE(source."settled_at", source."updated_at") AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
          ), 0)::numeric AS credit_source_loss,
          COALESCE((
            SELECT SUM(consumer."realized_profit")
            FROM "operations" consumer
            WHERE consumer."user_id" = ${userId}::uuid
              AND consumer."status" = 'SETTLED'
              AND to_char(consumer."settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
              AND EXISTS (
                SELECT 1 FROM "bet_credits" consumed_credit
                JOIN "operations" credit_source
                  ON credit_source."id" = consumed_credit."source_operation_id"
                WHERE consumed_credit."consumer_operation_id" = consumer."id"
                  AND consumed_credit."status" = 'CONSUMED'
                  AND credit_source."realized_profit" < 0
              )
          ), 0)::numeric AS credit_conversion_profit,
          COALESCE((
            SELECT SUM(contribution."amount")
            FROM "wallet_transactions" contribution
            WHERE contribution."user_id" = ${userId}::uuid
              AND contribution."type" IN ('INITIAL_BALANCE', 'DEPOSIT')
          ), 0)::numeric AS contributed_capital,
          COALESCE((
            SELECT SUM(free_winning."amount")
            FROM "wallet_transactions" free_winning
            WHERE free_winning."user_id" = ${userId}::uuid
              AND free_winning."type" = 'BONUS_RECEIVED'
              AND to_char(free_winning."occurred_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
          ), 0)::numeric AS free_winnings
        FROM "operations" o
        LEFT JOIN "bet_credits" c ON c."source_operation_id" = o."id"
        WHERE o."user_id" = ${userId}::uuid AND o."status" = 'SETTLED'
          AND to_char(o."settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
      `),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT movement.day, COALESCE(SUM(movement.result), 0)::numeric AS result
        FROM (
          SELECT to_char("settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
            "realized_profit"::numeric AS result
          FROM "operations"
          WHERE "user_id" = ${userId}::uuid AND "status" = 'SETTLED'
            AND to_char("settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
          UNION ALL
          SELECT to_char("occurred_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
            "amount"::numeric AS result
          FROM "wallet_transactions"
          WHERE "user_id" = ${userId}::uuid AND "type" = 'BONUS_RECEIVED'
            AND to_char("occurred_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
        ) movement
        GROUP BY movement.day ORDER BY movement.day
      `),
      this.prisma.$queryRaw<BalanceRow[]>(Prisma.sql`
        SELECT a."id", COALESCE(a."nickname", a."name") AS name,
          a."cached_balance" AS available,
          COALESCE((SELECT SUM(l."risk_amount") FROM "bet_legs" l JOIN "operations" o ON o."id" = l."operation_id"
            WHERE l."bookmaker_account_id" = a."id" AND o."status" = 'OPEN' AND l."uses_bet_credit" = false), 0)::numeric AS open_stake,
          COALESCE((SELECT SUM(w."amount") FROM "wallet_transactions" w
            WHERE w."bookmaker_account_id" = a."id" AND (
              (w."type" = 'BONUS_RECEIVED'
                AND to_char(w."occurred_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month})
              OR (w."type" IN ('BET_STAKE', 'BET_REFUND', 'BET_RETURN') AND EXISTS (
                SELECT 1 FROM "operations" settled_operation
                WHERE settled_operation."id" = w."operation_id" AND settled_operation."status" = 'SETTLED'
                  AND to_char(settled_operation."settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
              ))
            )), 0)::numeric AS monthly_result
        FROM "bookmaker_accounts" a WHERE a."user_id" = ${userId}::uuid ORDER BY name
      `),
      this.prisma.operation.findMany({
        where: { userId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          id: true,
          sequenceNumber: true,
          eventName: true,
          status: true,
          projectedProfit: true,
          realizedProfit: true,
          createdAt: true,
          settledAt: true,
        },
      }),
    ]);
    const summary = summaryRows[0] ?? {
      profit: new Prisma.Decimal(0),
      loss: new Prisma.Decimal(0),
      net: new Prisma.Decimal(0),
      investment: new Prisma.Decimal(0),
      settled: 0n,
      definitive_loss: new Prisma.Decimal(0),
      credit_source_loss: new Prisma.Decimal(0),
      credit_conversion_profit: new Prisma.Decimal(0),
      contributed_capital: new Prisma.Decimal(0),
      free_winnings: new Prisma.Decimal(0),
    };
    const realizedProfit = summary.profit.add(summary.free_winnings);
    const netResult = summary.net.add(summary.free_winnings);
    const daily = new Map(dailyRows.map((row) => [row.day, row.result]));
    let accumulated = new Prisma.Decimal(0);
    const dailyEvolution = this.daysOfMonth(month).map((date) => {
      const result = daily.get(date) ?? new Prisma.Decimal(0);
      accumulated = accumulated.add(result);
      return {
        date,
        result: result.toFixed(2),
        accumulated: accumulated.toFixed(2),
      };
    });
    const availableBalance = balanceRows.reduce(
      (sum, row) => sum.add(row.available),
      new Prisma.Decimal(0),
    );
    const openStake = balanceRows.reduce(
      (sum, row) => sum.add(row.open_stake),
      new Prisma.Decimal(0),
    );
    return {
      month,
      timezone: "America/Sao_Paulo",
      metrics: {
        realizedProfit: realizedProfit.toFixed(2),
        realizedLoss: summary.definitive_loss.toFixed(2),
        creditGeneratingLoss: summary.credit_source_loss.toFixed(2),
        creditConversionProfit: summary.credit_conversion_profit.toFixed(2),
        netResult: netResult.toFixed(2),
        roiPercent: summary.contributed_capital.isZero()
          ? "0"
          : netResult.div(summary.contributed_capital).mul(100).toFixed(6),
        freeWinnings: summary.free_winnings.toFixed(2),
        contributedCapital: summary.contributed_capital.toFixed(2),
        realCashInvestmentSettled: summary.investment.toFixed(2),
        settledOperations: Number(summary.settled),
        openStake: openStake.toFixed(2),
        availableBalance: availableBalance.toFixed(2),
        equity: availableBalance.add(openStake).toFixed(2),
        previousMonthComparisonPercent: null,
      },
      dailyEvolution,
      balancesByBookmaker: balanceRows.map((row) => ({
        id: row.id,
        name: row.name,
        availableBalance: row.available.toFixed(2),
        openStake: row.open_stake.toFixed(2),
        equity: row.available.add(row.open_stake).toFixed(2),
        monthlyResult: row.monthly_result.toFixed(2),
      })),
      recentOperations: recent.map((operation) => ({
        ...operation,
        projectedProfit: operation.projectedProfit.toFixed(2),
        realizedProfit: operation.realizedProfit?.toFixed(2) ?? null,
      })),
    };
  }

  private daysOfMonth(month: string): string[] {
    const [year, value] = month.split("-").map(Number);
    const count = new Date(Date.UTC(year ?? 0, value ?? 1, 0)).getUTCDate();
    return Array.from(
      { length: count },
      (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
    );
  }
}
