import { decimal, Decimal, roundMoney } from "./decimal";
import { CalculationValidationError } from "./errors";
import { BetLegInput, PreparedBetLeg } from "./types";

export function prepareBetLeg(input: BetLegInput, path = "leg"): PreparedBetLeg {
  const stake = decimal(input.stake, `${path}.stake`);
  const odd = decimal(input.odd, `${path}.odd`);
  const increasePercent = decimal(input.increasePercent ?? 0, `${path}.increasePercent`);
  const commissionPercent = decimal(
    input.commissionPercent ?? 0,
    `${path}.commissionPercent`,
  );
  const cashbackPercent = decimal(input.cashbackPercent ?? 0, `${path}.cashbackPercent`);

  if (stake.lte(0)) {
    throw new CalculationValidationError("Stake deve ser maior que zero.", `${path}.stake`);
  }
  if (odd.lte(1)) {
    throw new CalculationValidationError("Odd deve ser maior que 1.", `${path}.odd`);
  }
  if (increasePercent.isNegative()) {
    throw new CalculationValidationError(
      "Aumento não pode ser negativo.",
      `${path}.increasePercent`,
    );
  }
  if (commissionPercent.isNegative() || commissionPercent.gte(100)) {
    throw new CalculationValidationError(
      "Comissão deve estar entre 0 e 100% (exclusivo).",
      `${path}.commissionPercent`,
    );
  }
  if (cashbackPercent.isNegative() || cashbackPercent.gt(100)) {
    throw new CalculationValidationError(
      "Cashback em dinheiro deve estar entre 0 e 100%.",
      `${path}.cashbackPercent`,
    );
  }

  const profitFactor = odd
    .minus(1)
    .mul(new Decimal(1).plus(increasePercent.div(100)))
    .mul(new Decimal(1).minus(commissionPercent.div(100)));
  const effectiveOdd = new Decimal(1).plus(profitFactor);
  const usesBetCredit = input.usesBetCredit ?? false;
  const payoutMultiplier = usesBetCredit ? profitFactor : effectiveOdd;

  return {
    stake,
    odd,
    increasePercent,
    commissionPercent,
    cashbackPercent,
    usesBetCredit,
    profitFactor,
    effectiveOdd,
    payoutMultiplier,
    projectedPayout: roundMoney(stake.mul(payoutMultiplier)),
  };
}

export function calculateEffectiveOdd(
  odd: BetLegInput["odd"],
  increasePercent: BetLegInput["increasePercent"] = 0,
  commissionPercent: BetLegInput["commissionPercent"] = 0,
): Decimal {
  return prepareBetLeg({ stake: 1, odd, increasePercent, commissionPercent }).effectiveOdd;
}
