import assert from "node:assert/strict";
import test from "node:test";
import {
  balanceStakes,
  calculateEffectiveOdd,
  calculateOperationSnapshot,
  calculatePromotionProfit,
  calculateSettlement,
  CalculationValidationError,
  convertFreebet,
  optimizeStake,
  prepareBetLeg,
  roundMoney,
  serializeDecimals,
} from "../dist/index.js";

const fixed = (value, places = 2) => value.toFixed(places);

test("README: turbo de 30% sobre o lucro gera odd efetiva 2.30", () => {
  const leg = prepareBetLeg({ stake: "100", odd: "2", increasePercent: "30" });
  assert.equal(fixed(leg.profitFactor, 3), "1.300");
  assert.equal(fixed(leg.effectiveOdd, 3), "2.300");
  assert.equal(fixed(leg.projectedPayout), "230.00");
});

test("README: aumento de 30% com comissão de 5% gera odd efetiva 2.235", () => {
  assert.equal(fixed(calculateEffectiveOdd("2", "30", "5"), 3), "2.235");
});

test("README: exemplo completo equilibra R$ 100 a 2.43 com R$ 121.50 a 2.00", () => {
  const balanced = balanceStakes([
    { stake: "100", odd: "2.10", increasePercent: "30" },
    { odd: "2.00" },
  ]);
  assert.equal(fixed(balanced[1].stake), "121.50");
  const snapshot = calculateOperationSnapshot(balanced);
  assert.deepEqual(
    snapshot.legs.map((leg) => fixed(leg.scenarioResult)),
    ["21.50", "21.50"],
  );
  const settlement = calculateSettlement(balanced, ["WON", "WON"]);
  assert.equal(fixed(settlement.realizedProfit), "264.50");
});

test("README: comissão permanece sobre o lucro e não reduz a stake", () => {
  const balanced = balanceStakes([
    { stake: "100", odd: "2", increasePercent: "30", commissionPercent: "5" },
    { odd: "2" },
  ]);
  assert.equal(fixed(balanced[1].stake), "111.75");
  const snapshot = calculateOperationSnapshot(balanced);
  assert.deepEqual(
    snapshot.legs.map((leg) => fixed(leg.scenarioResult)),
    ["11.75", "11.75"],
  );
});

test("balances three lines by the same target payout and recalculates cents", () => {
  const balanced = balanceStakes([
    { stake: "100", odd: "3" },
    { odd: "2.6" },
    { odd: "3.9" },
  ]);
  assert.deepEqual(
    balanced.map((leg) => fixed(leg.stake)),
    ["100.00", "115.38", "76.92"],
  );
  const snapshot = calculateOperationSnapshot(balanced);
  assert.equal(fixed(snapshot.realCashInvestment), "292.30");
  assert.equal(fixed(snapshot.protectedReturn), "299.99");
  assert.equal(fixed(snapshot.projectedProfit), "7.69");
});

test("manual stakes are preserved and only scenario results change", () => {
  const balanced = balanceStakes([
    { stake: "100", odd: "3" },
    { stake: "120", odd: "2.6", manualStake: true },
  ]);
  assert.equal(fixed(balanced[1].stake), "120.00");
  const snapshot = calculateOperationSnapshot(balanced);
  assert.notEqual(
    fixed(snapshot.legs[0].scenarioResult),
    fixed(snapshot.legs[1].scenarioResult),
  );
});

test("cashback em dinheiro entra somente quando a linha perde", () => {
  const inputs = [
    { stake: "100", odd: "2" },
    { stake: "100", odd: "2", cashbackPercent: "10" },
  ];
  const snapshot = calculateOperationSnapshot(inputs);
  assert.equal(fixed(snapshot.legs[0].scenarioResult), "10.00");
  assert.equal(fixed(snapshot.legs[1].scenarioResult), "0.00");
  const settlement = calculateSettlement(inputs, ["WON", "LOST"]);
  assert.equal(fixed(settlement.cashbackReturn), "10.00");
  assert.equal(fixed(settlement.realizedProfit), "10.00");
});

test("README: balanceamento com cashback usa G + 1 - CB", () => {
  const balanced = balanceStakes([
    { stake: "100", odd: "2", cashbackPercent: "10" },
    { odd: "2", cashbackPercent: "0" },
  ]);
  assert.equal(fixed(balanced[1].stake), "95.00");
  const snapshot = calculateOperationSnapshot(balanced);
  assert.deepEqual(
    snapshot.legs.map((leg) => fixed(leg.scenarioResult)),
    ["5.00", "5.00"],
  );
});

test("crédito não devolve stake e não entra no investimento real", () => {
  const snapshot = calculateOperationSnapshot([
    { stake: "50", odd: "3", usesBetCredit: true },
    { stake: "50", odd: "2", usesBetCredit: false },
  ]);
  assert.equal(fixed(snapshot.legs[0].projectedPayout), "100.00");
  assert.equal(fixed(snapshot.realCashInvestment), "50.00");
  assert.equal(fixed(snapshot.promotionalStake), "50.00");
});

test("balanceamento usa profitFactor no lado de crédito", () => {
  const balanced = balanceStakes([
    { stake: "50", odd: "3", usesBetCredit: true },
    { odd: "2" },
  ]);
  assert.equal(fixed(balanced[1].stake), "50.00");
});

test("liquidação soma múltiplas linhas vencedoras", () => {
  const settlement = calculateSettlement(
    [
      { stake: "100", odd: "2" },
      { stake: "100", odd: "2" },
    ],
    ["WON", "WON"],
  );
  assert.equal(fixed(settlement.realizedReturn), "400.00");
  assert.equal(fixed(settlement.realizedProfit), "200.00");
});

test("README: conversão de freebet equilibra pelo profitFactor", () => {
  const conversion = convertFreebet({
    freebet: "100",
    freebetOdd: "3",
    hedgeOdd: "2",
  });
  assert.equal(fixed(conversion.hedgeStake), "100.00");
  assert.equal(fixed(conversion.resultFreebetWins), "100.00");
  assert.equal(fixed(conversion.resultHedgeWins), "100.00");
  assert.equal(fixed(conversion.conversionRatePercent), "100.00");
});

test("README: lucro da promoção desconta o custo de qualificação", () => {
  assert.equal(fixed(calculatePromotionProfit("13.33", "5")), "8.33");
});

test("roundMoney usa HALF_UP e não ponto flutuante binário", () => {
  assert.equal(fixed(roundMoney("1.005")), "1.01");
  assert.equal(fixed(roundMoney("2.675")), "2.68");
});

test("otimizador escolhe os centavos com melhor pior cenário", () => {
  const best = optimizeStake({
    theoreticalStake: "10.034",
    radiusInCents: 3,
    calculateScenarios: (stake) => [
      stake.minus("10"),
      new stake.constructor("10.05").minus(stake),
    ],
  });
  // 10.02 and 10.03 tie at two cents; deterministic tie-breaking keeps the lower stake.
  assert.equal(fixed(best.stake), "10.02");
});

test("serializa Decimal como string para contratos JSON", () => {
  const serialized = serializeDecimals(calculateEffectiveOdd("2", "30"));
  assert.equal(serialized, "2.3");
});

test("valida stake, odd, comissão, aumento e cashback", () => {
  for (const input of [
    { stake: "0", odd: "2" },
    { stake: "10", odd: "1" },
    { stake: "10", odd: "2", commissionPercent: "100" },
    { stake: "10", odd: "2", increasePercent: "-1" },
    { stake: "10", odd: "2", cashbackPercent: "101" },
  ]) {
    assert.throws(() => prepareBetLeg(input), CalculationValidationError);
  }
});

test("aceita comissão percentual decimal", () => {
  const leg = prepareBetLeg({
    stake: "100",
    odd: "2",
    commissionPercent: "2.5",
  });
  assert.equal(leg.commissionPercent.toString(), "2.5");
  assert.equal(leg.effectiveOdd.toFixed(6), "1.975000");
});

test("liquidação exige exatamente um resultado por linha e ao menos um green", () => {
  const inputs = [
    { stake: "10", odd: "2" },
    { stake: "10", odd: "2" },
  ];
  assert.throws(
    () => calculateSettlement(inputs, ["WON"]),
    CalculationValidationError,
  );
  assert.throws(
    () => calculateSettlement(inputs, ["LOST", "LOST"]),
    CalculationValidationError,
  );
});
