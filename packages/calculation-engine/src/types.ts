import type Decimal from "decimal.js";

export type DecimalInput = Decimal.Value;
export type BetType = "BACK" | "LAY";

export interface BetLegInput {
  stake: DecimalInput;
  odd: DecimalInput;
  increasePercent?: DecimalInput;
  commissionPercent?: DecimalInput;
  cashbackPercent?: DecimalInput;
  usesBetCredit?: boolean;
  betType?: BetType;
}

export interface BalanceLegInput extends Omit<BetLegInput, "stake"> {
  stake?: DecimalInput;
  manualStake?: boolean;
}

export interface PreparedBetLeg {
  stake: Decimal;
  odd: Decimal;
  increasePercent: Decimal;
  commissionPercent: Decimal;
  cashbackPercent: Decimal;
  usesBetCredit: boolean;
  betType: BetType;
  riskAmount: Decimal;
  profitFactor: Decimal;
  effectiveOdd: Decimal;
  payoutMultiplier: Decimal;
  projectedPayout: Decimal;
}

export type SettlementResult = "WON" | "LOST";

export interface OperationSnapshot {
  legs: Array<PreparedBetLeg & { scenarioResult: Decimal }>;
  realCashInvestment: Decimal;
  promotionalStake: Decimal;
  protectedReturn: Decimal;
  projectedProfit: Decimal;
  projectedRoiPercent: Decimal;
  arbitrageIndex: Decimal;
  isSurebet: boolean;
  roundingPolicy: "HALF_UP_2_DECIMALS_RECALCULATE";
  engineVersion: string;
}

export interface SettlementSnapshot {
  realizedReturn: Decimal;
  realizedProfit: Decimal;
  realizedRoiPercent: Decimal;
  winningPayout: Decimal;
  cashbackReturn: Decimal;
}
