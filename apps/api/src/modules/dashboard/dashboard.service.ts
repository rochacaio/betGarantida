import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

interface SummaryRow {
  profit: Prisma.Decimal;
  loss: Prisma.Decimal;
  net: Prisma.Decimal;
  investment: Prisma.Decimal;
  settled: bigint;
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
          COALESCE(SUM(CASE WHEN "realized_profit" > 0 THEN "realized_profit" ELSE 0 END), 0)::numeric AS profit,
          ABS(COALESCE(SUM(CASE WHEN "realized_profit" < 0 THEN "realized_profit" ELSE 0 END), 0))::numeric AS loss,
          COALESCE(SUM("realized_profit"), 0)::numeric AS net,
          COALESCE(SUM("real_cash_investment"), 0)::numeric AS investment,
          COUNT(*)::bigint AS settled
        FROM "operations"
        WHERE "user_id" = ${userId}::uuid AND "status" = 'SETTLED'
          AND to_char("settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
      `),
      this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
        SELECT to_char("settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
          COALESCE(SUM("realized_profit"), 0)::numeric AS result
        FROM "operations"
        WHERE "user_id" = ${userId}::uuid AND "status" = 'SETTLED'
          AND to_char("settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
        GROUP BY 1 ORDER BY 1
      `),
      this.prisma.$queryRaw<BalanceRow[]>(Prisma.sql`
        SELECT a."id", COALESCE(a."nickname", a."name") AS name,
          a."cached_balance" AS available,
          COALESCE((SELECT SUM(l."stake") FROM "bet_legs" l JOIN "operations" o ON o."id" = l."operation_id"
            WHERE l."bookmaker_account_id" = a."id" AND o."status" = 'OPEN' AND l."uses_bet_credit" = false), 0)::numeric AS open_stake,
          COALESCE((SELECT SUM(w."amount") FROM "wallet_transactions" w JOIN "operations" o ON o."id" = w."operation_id"
            WHERE w."bookmaker_account_id" = a."id" AND o."status" = 'SETTLED'
              AND to_char(o."settled_at" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = ${month}
              AND w."type" IN ('BET_STAKE', 'BET_REFUND', 'BET_RETURN')), 0)::numeric AS monthly_result
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
    };
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
        realizedProfit: summary.profit.toFixed(2),
        realizedLoss: summary.loss.toFixed(2),
        netResult: summary.net.toFixed(2),
        roiPercent: summary.investment.isZero()
          ? "0"
          : summary.net.div(summary.investment).mul(100).toFixed(6),
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
