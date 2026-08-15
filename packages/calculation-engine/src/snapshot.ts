import { decimal, Decimal, roundMoney } from "./decimal";
import { CalculationValidationError } from "./errors";
import { prepareBetLeg } from "./leg";
import {
  BalanceLegInput,
  BetLegInput,
  OperationSnapshot,
  SettlementResult,
  SettlementSnapshot,
} from "./types";

export const CALCULATION_ENGINE_VERSION = "1.1.0" as const;
export const ROUNDING_POLICY = "HALF_UP_2_DECIMALS_RECALCULATE" as const;

export function balanceStakes(inputs: BalanceLegInput[]): BetLegInput[] {
  if (inputs.length < 2) {
    throw new CalculationValidationError(
      "A operação precisa de pelo menos duas linhas.",
      "legs",
    );
  }
  const anchor = inputs[0];
  if (anchor?.stake === undefined) {
    throw new CalculationValidationError(
      "A primeira stake é obrigatória.",
      "legs.0.stake",
    );
  }
  const preparedAnchor = prepareBetLeg(
    { ...anchor, stake: anchor.stake },
    "legs.0",
  );
  const anchorBalanceFactor = preparedAnchor.payoutMultiplier.minus(
    preparedAnchor.cashbackPercent.div(100),
  );
  const targetBalance = preparedAnchor.riskAmount.mul(anchorBalanceFactor);

  return inputs.map((input, index) => {
    if (index === 0 || (input.manualStake && input.stake !== undefined)) {
      if (input.stake === undefined) {
        throw new CalculationValidationError(
          "Stake manual é obrigatória.",
          `legs.${index}.stake`,
        );
      }
      return { ...input, stake: roundMoney(input.stake) };
    }
    const unitLeg = prepareBetLeg({ ...input, stake: 1 }, `legs.${index}`);
    const balanceFactor = unitLeg.payoutMultiplier.minus(
      unitLeg.cashbackPercent.div(100),
    );
    if (balanceFactor.lte(0)) {
      throw new CalculationValidationError(
        "Não é possível balancear esta combinação de payout e cashback.",
        `legs.${index}`,
      );
    }
    const stakePerUnit = unitLeg.riskAmount.mul(balanceFactor);
    return { ...input, stake: roundMoney(targetBalance.div(stakePerUnit)) };
  });
}

export function calculateOperationSnapshot(
  inputs: BetLegInput[],
): OperationSnapshot {
  if (inputs.length < 2) {
    throw new CalculationValidationError(
      "A operação precisa de pelo menos duas linhas.",
      "legs",
    );
  }
  const roundedInputs = inputs.map((input) => ({
    ...input,
    stake: roundMoney(input.stake),
  }));
  const prepared = roundedInputs.map((input, index) =>
    prepareBetLeg(input, `legs.${index}`),
  );
  const realCashInvestment = roundMoney(
    prepared.reduce(
      (total, leg) => total.plus(leg.usesBetCredit ? 0 : leg.riskAmount),
      new Decimal(0),
    ),
  );
  const promotionalStake = roundMoney(
    prepared.reduce(
      (total, leg) => total.plus(leg.usesBetCredit ? leg.stake : 0),
      new Decimal(0),
    ),
  );
  const scenarioReturns = prepared.map((winningLeg, winningIndex) => {
    const cashback = prepared.reduce((total, losingLeg, losingIndex) => {
      if (losingIndex === winningIndex) return total;
      return total.plus(
        losingLeg.stake.mul(losingLeg.cashbackPercent.div(100)),
      );
    }, new Decimal(0));
    return roundMoney(winningLeg.projectedPayout.plus(cashback));
  });
  const scenarioResults = scenarioReturns.map((value) =>
    roundMoney(value.minus(realCashInvestment)),
  );
  const protectedReturn = Decimal.min(...scenarioReturns);
  const projectedProfit = roundMoney(protectedReturn.minus(realCashInvestment));
  const projectedRoiPercent = realCashInvestment.isZero()
    ? new Decimal(0)
    : projectedProfit.div(realCashInvestment).mul(100);
  const arbitrageIndex = prepared.reduce(
    (total, leg) => total.plus(new Decimal(1).div(leg.payoutMultiplier)),
    new Decimal(0),
  );

  return {
    legs: prepared.map((leg, index) => ({
      ...leg,
      scenarioResult: scenarioResults[index]!,
    })),
    realCashInvestment,
    promotionalStake,
    protectedReturn,
    projectedProfit,
    projectedRoiPercent,
    arbitrageIndex,
    isSurebet: arbitrageIndex.lt(1),
    roundingPolicy: ROUNDING_POLICY,
    engineVersion: CALCULATION_ENGINE_VERSION,
  };
}

export function calculateSettlement(
  inputs: BetLegInput[],
  results: SettlementResult[],
): SettlementSnapshot {
  if (inputs.length !== results.length) {
    throw new CalculationValidationError(
      "Cada linha precisa de um resultado.",
      "results",
    );
  }
  if (!results.includes("WON")) {
    throw new CalculationValidationError(
      "Ao menos uma linha precisa ser vencedora.",
      "results",
    );
  }
  const snapshot = calculateOperationSnapshot(inputs);
  const winningPayout = roundMoney(
    snapshot.legs.reduce(
      (total, leg, index) =>
        total.plus(results[index] === "WON" ? leg.projectedPayout : 0),
      new Decimal(0),
    ),
  );
  const cashbackReturn = roundMoney(
    snapshot.legs.reduce(
      (total, leg, index) =>
        total.plus(
          results[index] === "LOST"
            ? leg.stake.mul(leg.cashbackPercent.div(100))
            : 0,
        ),
      new Decimal(0),
    ),
  );
  const realizedReturn = roundMoney(winningPayout.plus(cashbackReturn));
  const realizedProfit = roundMoney(
    realizedReturn.minus(snapshot.realCashInvestment),
  );
  const realizedRoiPercent = snapshot.realCashInvestment.isZero()
    ? new Decimal(0)
    : realizedProfit.div(snapshot.realCashInvestment).mul(100);
  return {
    realizedReturn,
    realizedProfit,
    realizedRoiPercent,
    winningPayout,
    cashbackReturn,
  };
}

export function optimizeStake(input: {
  theoreticalStake: BetLegInput["stake"];
  calculateScenarios: (stake: Decimal) => Decimal[];
  radiusInCents?: number;
}): { stake: Decimal; guaranteedResult: Decimal } {
  const center = decimal(input.theoreticalStake).mul(100).round();
  const radius = input.radiusInCents ?? 10;
  let best: { stake: Decimal; guaranteedResult: Decimal } | undefined;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const cents = center.plus(offset);
    if (cents.isNegative()) continue;
    const stake = cents.div(100);
    const scenarios = input.calculateScenarios(stake);
    if (!scenarios.length)
      throw new CalculationValidationError("Cenários são obrigatórios.");
    const guaranteedResult = Decimal.min(...scenarios);
    if (!best || guaranteedResult.gt(best.guaranteedResult))
      best = { stake, guaranteedResult };
  }
  if (!best)
    throw new CalculationValidationError("Não foi possível otimizar a stake.");
  return best;
}
