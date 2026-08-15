# 05 — Motor de cálculo

O documento matemático de origem é `README_Bet_Sem_Medo.md`. Este pacote deve transformar suas fórmulas em funções puras testadas.

## Entradas por perna

`betType`, `stake`, `odd`, `increasePercent`, `commissionPercent`, `cashbackPercent`, `usesBetCredit`.

## Fórmulas base

```text
profitFactor = (odd - 1) × (1 + increase/100) × (1 - commission/100)
effectiveOdd = 1 + profitFactor
cashPayout = stake × effectiveOdd
betCreditPayout = stake × profitFactor
```

Crédito não devolve stake. Portanto, não compõe investimento real nem o denominador do ROI.

Para balancear linhas pelo retorno:

```text
targetPayout = anchorStake × anchorPayoutMultiplier
stakeN = targetPayout / payoutMultiplierN
```

Onde `payoutMultiplier` é `effectiveOdd` para caixa e `profitFactor` para crédito.

## Linha Lay

No `LAY`, o usuário aposta contra o resultado. O valor informado é a stake Lay,
mas o dinheiro exposto e movimentado na casa é a responsabilidade:

```text
liability = layStake × (odd - 1)
netWin = layStake × (1 - commission/100)
effectiveBackOdd = 1 + netWin / liability
layPayoutMultiplier = effectiveBackOdd
```

Se a linha Lay vence, a casa devolve a responsabilidade e credita `netWin`. Se
perde, a responsabilidade é perdida. Balanceamento, investimento real, saldo em
apostas e ROI usam `liability`, nunca a stake Lay. Crédito de aposta, cashback e
aumento não são aceitos em uma linha Lay.

Quando houver cashback em dinheiro, o balanceamento considera o valor recuperado
no cenário em que a linha perde:

```text
balanceFactor = payoutMultiplier - cashbackPercent/100
targetBalance = anchorStake × anchorBalanceFactor
stakeN = targetBalance / balanceFactorN
```

Para cada cenário vencedor `i`:

```text
scenarioReturn[i] = payout[i] + soma do cashback em dinheiro das pernas perdedoras
scenarioResult[i] = scenarioReturn[i] - realCashInvestment
protectedReturn = mínimo dos retornos dos cenários
projectedProfit = protectedReturn - realCashInvestment
projectedRoi = projectedProfit / realCashInvestment × 100
```

Na liquidação:

```text
realizedReturn = soma dos payouts das pernas WON + cashback em dinheiro das pernas LOST
realizedProfit = realizedReturn - realCashInvestment
realizedRoi = realizedProfit / realCashInvestment × 100
```

Cashback deve seguir exatamente as regras do README e possuir cenários de teste antes de ser considerado suportado em produção.

## Arredondamento

- Calcular internamente com Decimal e precisão ampliada.
- Stakes persistidas e movimentações são arredondadas para centavos.
- Não arredondar valores intermediários sem indicação da fórmula.
- O snapshot deve guardar a política e `engineVersion`.
- Após arredondar stakes, recalcular todos os cenários; o valor exibido é o resultado recalculado.

## Snapshot de resposta

- por perna: `betType`, `riskAmount`, `profitFactor`, `effectiveOdd`, `projectedPayout`, `scenarioResult`;
- operação: `realCashInvestment`, `promotionalStake`, `protectedReturn`, `projectedProfit`, `projectedRoiPercent`, `engineVersion`.

## Fonte de verdade

O cliente pode sugerir stakes automáticas. O endpoint de preview e os endpoints de escrita recalculam tudo. Campos calculados enviados pelo cliente são ignorados.
