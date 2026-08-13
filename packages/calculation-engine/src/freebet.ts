import { Decimal, roundMoney } from "./decimal";
import { CalculationValidationError } from "./errors";
import { prepareBetLeg } from "./leg";
import { BetLegInput, DecimalInput } from "./types";

export function convertFreebet(input: {
  freebet: DecimalInput;
  freebetOdd: DecimalInput;
  freebetIncreasePercent?: DecimalInput;
  freebetCommissionPercent?: DecimalInput;
  hedgeOdd: DecimalInput;
  hedgeIncreasePercent?: DecimalInput;
  hedgeCommissionPercent?: DecimalInput;
}) {
  const freebet = prepareBetLeg({
    stake: input.freebet,
    odd: input.freebetOdd,
    increasePercent: input.freebetIncreasePercent,
    commissionPercent: input.freebetCommissionPercent,
    usesBetCredit: true,
  });
  const hedgeUnit = prepareBetLeg({
    stake: 1,
    odd: input.hedgeOdd,
    increasePercent: input.hedgeIncreasePercent,
    commissionPercent: input.hedgeCommissionPercent,
  });
  const hedgeStake = roundMoney(
    freebet.stake.mul(freebet.profitFactor).div(hedgeUnit.effectiveOdd),
  );
  const hedge = prepareBetLeg({
    stake: hedgeStake,
    odd: input.hedgeOdd,
    increasePercent: input.hedgeIncreasePercent,
    commissionPercent: input.hedgeCommissionPercent,
  });
  const resultFreebetWins = roundMoney(freebet.projectedPayout.minus(hedgeStake));
  const resultHedgeWins = roundMoney(hedge.stake.mul(hedge.profitFactor));
  const convertedValue = Decimal.min(resultFreebetWins, resultHedgeWins);
  const conversionRatePercent = convertedValue.div(freebet.stake).mul(100);
  return {
    hedgeStake,
    resultFreebetWins,
    resultHedgeWins,
    convertedValue,
    conversionRatePercent,
  };
}

export function calculatePromotionProfit(
  convertedFreebetValue: DecimalInput,
  qualificationCost: DecimalInput,
): Decimal {
  const result = new Decimal(convertedFreebetValue).minus(qualificationCost);
  if (!result.isFinite()) throw new CalculationValidationError("Valores da promoção inválidos.");
  return roundMoney(result);
}

export type { BetLegInput };
