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

export const CALCULATION_ENGINE_VERSION = "1.2.0" as const;
export const ROUNDING_POLICY = "HALF_UP_2_DECIMALS_RECALCULATE" as const;

export function balanceStakes(inputs: BalanceLegInput[]): BetLegInput[] {
  if (inputs.length < 2) {
    throw new CalculationValidationError(
      "A operação precisa de pelo menos duas linhas.",
      "legs",
    );
  }
  const scenarioKey = (input: BalanceLegInput, index: number) =>
    input.scenarioId ?? `legacy-${index}`;
  const groups = new Map<string, number[]>();
  inputs.forEach((input, index) => {
    const key = scenarioKey(input, index);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  if (groups.size < 2) {
    throw new CalculationValidationError(
      "A operação precisa de pelo menos dois cenários.",
      "legs",
    );
  }
  const groupEntries = [...groups.values()];
  const anchorIndexes = groupEntries[0]!;
  if (anchorIndexes.some((index) => inputs[index]?.stake === undefined)) {
    throw new CalculationValidationError(
      "Todas as stakes do primeiro cenário são obrigatórias.",
      "legs.0.stake",
    );
  }
  const contribution = (
    input: BalanceLegInput,
    stake: Decimal.Value,
    index: number,
  ) => {
    const leg = prepareBetLeg({ ...input, stake }, `legs.${index}`);
    return leg.riskAmount.mul(
      leg.payoutMultiplier.minus(leg.cashbackPercent.div(100)),
    );
  };
  const targetBalance = anchorIndexes.reduce(
    (total, index) =>
      total.plus(contribution(inputs[index]!, inputs[index]!.stake!, index)),
    new Decimal(0),
  );
  const balanced = inputs.map((input) => ({ ...input }));
  for (const indexes of groupEntries) {
    if (indexes === anchorIndexes) {
      indexes.forEach((index) => {
        balanced[index]!.stake = roundMoney(inputs[index]!.stake!);
      });
      continue;
    }
    const automatic = indexes.filter(
      (index) =>
        !inputs[index]!.manualStake || inputs[index]!.stake === undefined,
    );
    if (automatic.length > 1) {
      throw new CalculationValidationError(
        "Um cenário dividido pode ter apenas uma stake automática.",
        `legs.${automatic[1]}`,
      );
    }
    const fixed = indexes
      .filter((index) => !automatic.includes(index))
      .reduce((total, index) => {
        const input = inputs[index]!;
        if (input.stake === undefined) {
          throw new CalculationValidationError(
            "Stake manual é obrigatória.",
            `legs.${index}.stake`,
          );
        }
        balanced[index]!.stake = roundMoney(input.stake);
        return total.plus(contribution(input, input.stake, index));
      }, new Decimal(0));
    if (automatic.length === 0) continue;
    const index = automatic[0]!;
    const unitContribution = contribution(inputs[index]!, 1, index);
    if (unitContribution.lte(0)) {
      throw new CalculationValidationError(
        "Não é possível balancear esta combinação de payout e cashback.",
        `legs.${index}`,
      );
    }
    balanced[index]!.stake = roundMoney(
      Decimal.max(0, targetBalance.minus(fixed).div(unitContribution)),
    );
  }
  return balanced as BetLegInput[];
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
  const scenarioKeys = prepared.map(
    (leg, index) => leg.scenarioId ?? `legacy-${index}`,
  );
  const uniqueScenarios = [...new Set(scenarioKeys)];
  if (uniqueScenarios.length < 2) {
    throw new CalculationValidationError(
      "A operação precisa de pelo menos dois cenários.",
      "legs",
    );
  }
  const resultByScenario = new Map<string, Decimal>();
  const scenarioReturns = uniqueScenarios.map((winningScenario) => {
    const payout = prepared.reduce(
      (total, leg, index) =>
        total.plus(
          scenarioKeys[index] === winningScenario ? leg.projectedPayout : 0,
        ),
      new Decimal(0),
    );
    const cashback = prepared.reduce((total, losingLeg, losingIndex) => {
      if (scenarioKeys[losingIndex] === winningScenario) return total;
      return total.plus(
        losingLeg.stake.mul(losingLeg.cashbackPercent.div(100)),
      );
    }, new Decimal(0));
    return roundMoney(payout.plus(cashback));
  });
  const scenarioResults = scenarioReturns.map((value) =>
    roundMoney(value.minus(realCashInvestment)),
  );
  uniqueScenarios.forEach((scenario, index) =>
    resultByScenario.set(scenario, scenarioResults[index]!),
  );
  const protectedReturn = Decimal.min(...scenarioReturns);
  const projectedProfit = roundMoney(protectedReturn.minus(realCashInvestment));
  const projectedRoiPercent = realCashInvestment.isZero()
    ? new Decimal(0)
    : projectedProfit.div(realCashInvestment).mul(100);
  const arbitrageIndex = uniqueScenarios.reduce((total, scenario) => {
    const group = prepared.filter(
      (_, index) => scenarioKeys[index] === scenario,
    );
    const risk = group.reduce(
      (value, leg) => value.plus(leg.riskAmount),
      new Decimal(0),
    );
    const payout = group.reduce(
      (value, leg) =>
        value.plus(leg.riskAmount.mul(leg.payoutMultiplier)),
      new Decimal(0),
    );
    return total.plus(payout.isZero() ? 0 : risk.div(payout));
  }, new Decimal(0));

  return {
    legs: prepared.map((leg, index) => ({
      ...leg,
      scenarioResult: resultByScenario.get(scenarioKeys[index]!)!,
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
