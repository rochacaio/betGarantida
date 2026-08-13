# Proteção de Duplo, Surebet e Conversão de Freebet — Especificação Técnica

Este documento define o núcleo matemático de uma calculadora focada em:

1. **Proteção de Duplo** — principal prioridade do sistema.
2. **Surebet com lucro imediato**.
3. **Surebet/hedge para qualificar uma promoção e receber freebet**.
4. **Conversão posterior da freebet em dinheiro real**.
5. Suporte aos campos **Aumento (%)** e **Comissão (%)** em cada aposta.

> A estrutura foi inspirada nos campos públicos observáveis da calculadora BetTracker, que atualmente apresenta conceitos como **Arbitragem / Proteção de Duplo**, **ODD**, **Comissão**, **Cashback**, **Aumento** e **Back**.  
> As fórmulas abaixo representam a reconstrução matemática recomendada para o sistema. A implementação interna exata do BetTracker não foi obtida.

---

# 1. PRIORIDADE: PROTEÇÃO DE DUPLO

A **Proteção de Duplo** é uma operação com duas apostas que não são necessariamente mutuamente exclusivas.

Existem três cenários relevantes:

```txt
CENÁRIO A
Aposta A ganha
Aposta B perde

CENÁRIO B
Aposta A perde
Aposta B ganha

CENÁRIO DG
Aposta A ganha
Aposta B ganha
```

O terceiro cenário é o:

```txt
DUPLO GREEN
```

O objetivo da proteção é ajustar os valores apostados para que:

```txt
Cenário A ≈ Cenário B
```

enquanto preservamos o ganho muito maior caso ocorra:

```txt
Cenário DG
```

---

# 2. CAMPOS DE CADA APOSTA

Cada lado deve aceitar, no mínimo:

```ts
interface BetLeg {
  stake: number;
  odd: number;

  // BetTracker: "Aumento"
  increasePercent?: number;

  // BetTracker: "Comissão"
  commissionPercent?: number;
}
```

Exemplo:

```json
{
  "stake": 100,
  "odd": 2,
  "increasePercent": 30,
  "commissionPercent": 0
}
```

---

# 3. AUMENTO / TURBO

O campo:

```txt
Aumento
```

representa um aumento percentual aplicado sobre o **lucro da aposta vencedora**.

Exemplo:

```txt
Stake: R$ 100
Odd: 2.00
Aumento: 30%
```

Sem aumento:

```txt
Retorno bruto = 100 × 2.00
               = R$ 200

Lucro = 200 - 100
      = R$ 100
```

Com aumento de 30%:

```txt
Lucro base = R$ 100

Turbo = 100 × 30%
      = R$ 30

Lucro com turbo = R$ 130

Retorno total = 100 + 130
              = R$ 230
```

Portanto, para efeito dos cálculos, essa aposta se comporta como:

```txt
Odd efetiva = 2.30
```

e NÃO como:

```txt
2.00 × 1.30 = 2.60
```

O aumento é aplicado sobre o **lucro**, não sobre a stake devolvida.

---

# 4. FATOR DE LUCRO DA ODD

Para uma odd normal:

```math
G = O - 1
```

Onde:

```txt
G = ganho por real apostado
O = odd
```

Exemplo:

```txt
Odd 2.00

G = 2 - 1
G = 1
```

Cada R$1 apostado gera R$1 de lucro.

---

# 5. FATOR DE LUCRO COM AUMENTO

Definimos:

```txt
A = aumento em decimal
```

Exemplo:

```txt
30% = 0.30
```

Então:

```math
G_{boost} =
(O - 1)(1 + A)
```

Exemplo:

```txt
Odd = 2.00
Aumento = 30%
```

```txt
Gboost =
(2 - 1) × 1.30

Gboost = 1.30
```

---

# 6. COMISSÃO

O campo:

```txt
Comissão
```

deve ser aplicado sobre o lucro da aposta vencedora.

Definimos:

```txt
C = comissão em decimal
```

Exemplo:

```txt
5% = 0.05
```

Lucro após comissão:

```math
G_{net} =
G_{boost}(1 - C)
```

Ou diretamente:

```math
G_{net} =
(O - 1)
(1 + A)
(1 - C)
```

---

# 7. ODD EFETIVA

Para simplificar praticamente todo o restante do sistema, devemos calcular uma:

```txt
effectiveOdd
```

A odd efetiva é:

```math
O_{eff}
=
1 +
(O - 1)
(1 + A)
(1 - C)
```

Em TypeScript:

```ts
export function calculateEffectiveOdd(
  odd: number,
  increasePercent = 0,
  commissionPercent = 0
) {
  const increase =
    increasePercent / 100;

  const commission =
    commissionPercent / 100;

  const netProfitFactor =
    (odd - 1) *
    (1 + increase) *
    (1 - commission);

  return 1 + netProfitFactor;
}
```

---

# 8. EXEMPLO — AUMENTO + COMISSÃO

Dados:

```txt
Odd: 2.00
Aumento: 30%
Comissão: 5%
```

Lucro base por R$1:

```txt
2 - 1 = 1
```

Depois do aumento:

```txt
1 × 1.30 = 1.30
```

Depois da comissão:

```txt
1.30 × 0.95
= 1.235
```

Odd efetiva:

```txt
1 + 1.235
= 2.235
```

Portanto:

```txt
ODD informada: 2.00
ODD efetiva:   2.235
```

---

# 9. EXEMPLO DO USUÁRIO — R$100 COM TURBO DE 30%

Entrada:

```txt
Stake: R$100
Odd: 2.00
Aumento: 30%
Comissão: 0%
```

Lucro normal:

```txt
R$100
```

Aumento:

```txt
R$100 × 30%
= R$30
```

Lucro final:

```txt
R$130
```

Retorno:

```txt
R$230
```

Equivalentemente:

```txt
effectiveOdd = 2.30
```

Esse valor deve ser utilizado no cálculo da surebet/proteção.

---

# 10. FUNÇÃO PARA CALCULAR O LUCRO REAL DE UMA APOSTA

```ts
export function calculateWinningProfit(
  stake: number,
  odd: number,
  increasePercent = 0,
  commissionPercent = 0
) {
  const increase =
    increasePercent / 100;

  const commission =
    commissionPercent / 100;

  const baseProfit =
    stake * (odd - 1);

  const boostedProfit =
    baseProfit * (1 + increase);

  const commissionValue =
    boostedProfit * commission;

  const netProfit =
    boostedProfit -
    commissionValue;

  return {
    baseProfit,
    boostedProfit,
    commissionValue,
    netProfit,
    totalReturn:
      stake + netProfit,
  };
}
```

---

# 11. PROTEÇÃO DE DUPLO — VARIÁVEIS

Temos:

```txt
S1 = stake da aposta A
S2 = stake da aposta B

O1 = odd da aposta A
O2 = odd da aposta B

A1 = aumento da aposta A
A2 = aumento da aposta B

C1 = comissão da aposta A
C2 = comissão da aposta B
```

Calculamos:

```txt
E1 = odd efetiva da aposta A
E2 = odd efetiva da aposta B
```

---

# 12. FATOR DE LUCRO LÍQUIDO

É conveniente também trabalhar com:

```math
G_1 = E_1 - 1
```

```math
G_2 = E_2 - 1
```

Ou diretamente:

```math
G_1 =
(O_1 - 1)
(1 + A_1)
(1 - C_1)
```

```math
G_2 =
(O_2 - 1)
(1 + A_2)
(1 - C_2)
```

---

# 13. CENÁRIO A — APOSTA A GANHA

A aposta A gera lucro:

```math
S_1G_1
```

A aposta B perde:

```math
-S_2
```

Resultado final:

```math
R_A =
S_1G_1 - S_2
```

Em TypeScript:

```ts
const resultA =
  stake1 * profitFactor1 -
  stake2;
```

---

# 14. CENÁRIO B — APOSTA B GANHA

Resultado:

```math
R_B =
S_2G_2 - S_1
```

Em TypeScript:

```ts
const resultB =
  stake2 * profitFactor2 -
  stake1;
```

---

# 15. CENÁRIO DUPLO GREEN

Quando as duas apostas vencem, nenhuma stake é perdida.

O resultado é a soma dos lucros líquidos:

```math
R_{DG}
=
S_1G_1 +
S_2G_2
```

Em TypeScript:

```ts
const doubleGreenResult =
  stake1 * profitFactor1 +
  stake2 * profitFactor2;
```

---

# 16. OBJETIVO DA PROTEÇÃO

A proteção ideal busca:

```math
R_A = R_B
```

Portanto:

```math
S_1G_1 - S_2
=
S_2G_2 - S_1
```

Reorganizando:

```math
S_1(G_1 + 1)
=
S_2(G_2 + 1)
```

Como:

```math
G + 1 = O_{eff}
```

temos:

```math
S_1E_1
=
S_2E_2
```

Logo:

```math
\boxed{
S_2 =
\frac{S_1E_1}{E_2}
}
```

Esta é uma das fórmulas MAIS IMPORTANTES do sistema.

---

# 17. PROTEÇÃO DE DUPLO COM AUMENTO E COMISSÃO

Primeiro calculamos:

```math
E_1 =
1 +
(O_1 - 1)
(1 + A_1)
(1 - C_1)
```

```math
E_2 =
1 +
(O_2 - 1)
(1 + A_2)
(1 - C_2)
```

Depois:

```math
S_2 =
\frac{S_1E_1}{E_2}
```

---

# 18. EXEMPLO — PROTEÇÃO DE DUPLO COM TURBO

Aposta A:

```txt
Stake: R$100
Odd: 2.00
Aumento: 30%
Comissão: 0%
```

Aposta B:

```txt
Odd: 2.00
Aumento: 0%
Comissão: 0%
```

Odd efetiva A:

```txt
2.30
```

Odd efetiva B:

```txt
2.00
```

Proteção:

```txt
S2 =
100 × 2.30 / 2.00

S2 = R$115
```

---

## Cenário A ganha

Lucro da A:

```txt
100 × 1.30
= R$130
```

Perda da B:

```txt
-R$115
```

Resultado:

```txt
+R$15
```

---

## Cenário B ganha

Lucro da B:

```txt
115 × 1
= R$115
```

Perda da A:

```txt
-R$100
```

Resultado:

```txt
+R$15
```

---

## Duplo Green

As duas ganham:

```txt
Lucro A = R$130
Lucro B = R$115
```

Resultado:

```txt
R$245
```

Portanto:

```txt
Proteção normal: +R$15
Duplo Green:     +R$245
```

---

# 19. FUNÇÃO PRINCIPAL — PROTEÇÃO DE DUPLO

```ts
interface DoubleProtectionInput {
  stake1: number;

  odd1: number;
  increase1Percent?: number;
  commission1Percent?: number;

  odd2: number;
  increase2Percent?: number;
  commission2Percent?: number;
}

export function calculateDoubleProtection(
  input: DoubleProtectionInput
) {
  const {
    stake1,

    odd1,
    increase1Percent = 0,
    commission1Percent = 0,

    odd2,
    increase2Percent = 0,
    commission2Percent = 0,
  } = input;

  const effectiveOdd1 =
    calculateEffectiveOdd(
      odd1,
      increase1Percent,
      commission1Percent
    );

  const effectiveOdd2 =
    calculateEffectiveOdd(
      odd2,
      increase2Percent,
      commission2Percent
    );

  const profitFactor1 =
    effectiveOdd1 - 1;

  const profitFactor2 =
    effectiveOdd2 - 1;

  const theoreticalStake2 =
    (
      stake1 *
      effectiveOdd1
    ) /
    effectiveOdd2;

  const stake2 =
    roundMoney(
      theoreticalStake2
    );

  const result1Wins =
    roundMoney(
      stake1 *
        profitFactor1 -
      stake2
    );

  const result2Wins =
    roundMoney(
      stake2 *
        profitFactor2 -
      stake1
    );

  const doubleGreenResult =
    roundMoney(
      stake1 *
        profitFactor1 +
      stake2 *
        profitFactor2
    );

  const protectedResult =
    Math.min(
      result1Wins,
      result2Wins
    );

  return {
    effectiveOdd1,
    effectiveOdd2,

    stake1,
    stake2,

    result1Wins,
    result2Wins,

    protectedResult,
    doubleGreenResult,
  };
}
```

---

# 20. RESULTADO QUE A ABA "PROTEÇÃO DE DUPLO" DEVE EXIBIR

A interface deve dar destaque para:

```txt
VALOR APOSTA A
ODD A
AUMENTO A
COMISSÃO A

VALOR APOSTA B
ODD B
AUMENTO B
COMISSÃO B

STAKE DE PROTEÇÃO

RESULTADO SE A VENCER
RESULTADO SE B VENCER

RESULTADO PROTEGIDO

DUPLO GREEN
```

Exemplo:

```txt
Aposta A:       R$100 @ 2.00
Aumento A:      30%
Comissão A:     0%

Aposta B:       R$115 @ 2.00

A vence:        +R$15,00
B vence:        +R$15,00

Proteção:       +R$15,00
Duplo Green:    +R$245,00
```

---

# 21. ROI DA PROTEÇÃO

Capital efetivamente utilizado:

```math
T = S_1 + S_2
```

ROI protegido:

```math
ROI_{protected}
=
\frac{
\min(R_A,R_B)
}{
S_1+S_2
}
\times100
```

Em TypeScript:

```ts
const totalStake =
  stake1 + stake2;

const protectedROI =
  (
    protectedResult /
    totalStake
  ) * 100;
```

---

# 22. ROI DO DUPLO GREEN

Também pode ser exibido:

```math
ROI_{DG}
=
\frac{
R_{DG}
}{
S_1+S_2
}
\times100
```

---

# 23. SUREBET NORMAL USA A MESMA ODD EFETIVA

A mesma regra deve ser utilizada no módulo de surebet.

Não calcular arbitragem utilizando apenas:

```txt
odd1
odd2
```

quando houver:

```txt
Aumento
Comissão
```

Usar:

```txt
effectiveOdd1
effectiveOdd2
```

---

# 24. DETECÇÃO DE SUREBET COM AUMENTO E COMISSÃO

```math
Q =
\frac{1}{E_1}
+
\frac{1}{E_2}
```

Onde:

```txt
E1 = odd efetiva A
E2 = odd efetiva B
```

Temos:

```txt
Q < 1 → surebet
Q = 1 → neutra
Q > 1 → operação negativa
```

---

# 25. ROI TEÓRICO

```math
ROI =
\left(
\frac1Q - 1
\right)
\times100
```

---

# 26. STAKE DE PROTEÇÃO DA SUREBET

Com a stake A fixa:

```math
S_2 =
\frac{S_1E_1}{E_2}
```

Perceba que essa fórmula é igual à utilizada na:

```txt
Proteção de Duplo
```

A diferença está nos **cenários possíveis**.

Na surebet comum:

```txt
A ganha / B perde

OU

A perde / B ganha
```

Na Proteção de Duplo:

```txt
A ganha / B perde

OU

A perde / B ganha

OU

A ganha / B ganha
```

---

# 27. FUNÇÃO GENÉRICA PARA PREPARAR UMA APOSTA

```ts
interface BetInput {
  odd: number;
  increasePercent?: number;
  commissionPercent?: number;
}

export function normalizeBet(
  bet: BetInput
) {
  const increase =
    (bet.increasePercent ?? 0) /
    100;

  const commission =
    (bet.commissionPercent ?? 0) /
    100;

  const profitFactor =
    (bet.odd - 1) *
    (1 + increase) *
    (1 - commission);

  const effectiveOdd =
    1 + profitFactor;

  return {
    ...bet,
    increase,
    commission,
    profitFactor,
    effectiveOdd,
  };
}
```

---

# 28. FUNÇÃO DE SUREBET COM AUMENTO E COMISSÃO

```ts
export function calculateSurebet({
  stake1,

  odd1,
  increase1Percent = 0,
  commission1Percent = 0,

  odd2,
  increase2Percent = 0,
  commission2Percent = 0,
}: {
  stake1: number;

  odd1: number;
  increase1Percent?: number;
  commission1Percent?: number;

  odd2: number;
  increase2Percent?: number;
  commission2Percent?: number;
}) {
  const bet1 = normalizeBet({
    odd: odd1,
    increasePercent:
      increase1Percent,
    commissionPercent:
      commission1Percent,
  });

  const bet2 = normalizeBet({
    odd: odd2,
    increasePercent:
      increase2Percent,
    commissionPercent:
      commission2Percent,
  });

  const arbitrageIndex =
    1 / bet1.effectiveOdd +
    1 / bet2.effectiveOdd;

  const theoreticalStake2 =
    (
      stake1 *
      bet1.effectiveOdd
    ) /
    bet2.effectiveOdd;

  const stake2 =
    roundMoney(
      theoreticalStake2
    );

  const result1 =
    roundMoney(
      stake1 *
        bet1.profitFactor -
      stake2
    );

  const result2 =
    roundMoney(
      stake2 *
        bet2.profitFactor -
      stake1
    );

  const guaranteedProfit =
    Math.min(
      result1,
      result2
    );

  const totalStake =
    stake1 + stake2;

  return {
    stake1,
    stake2,

    effectiveOdd1:
      bet1.effectiveOdd,

    effectiveOdd2:
      bet2.effectiveOdd,

    arbitrageIndex,

    isSurebet:
      arbitrageIndex < 1,

    result1,
    result2,

    guaranteedProfit,

    totalStake,

    roiPercent:
      (
        guaranteedProfit /
        totalStake
      ) * 100,
  };
}
```

---

# 29. BANCA TOTAL FIXA

Quando o usuário informa o total que deseja investir:

```txt
T
```

usar as odds efetivas.

```math
Q =
\frac1{E_1}
+
\frac1{E_2}
```

Stake 1:

```math
S_1 =
T
\frac{
1/E_1
}{
Q
}
```

Stake 2:

```math
S_2 =
T
\frac{
1/E_2
}{
Q
}
```

Depois:

1. arredondar as stakes;
2. recalcular os resultados reais;
3. usar o pior resultado como lucro garantido.

---

# 30. COMISSÃO NÃO DEVE SER DESCONTADA DA STAKE

Exemplo:

```txt
Stake = 100
Odd = 2
Comissão = 5%
```

Não fazer:

```txt
100 × 0.95
```

A stake continua:

```txt
R$100
```

O lucro bruto é:

```txt
R$100
```

A comissão:

```txt
R$5
```

Lucro líquido:

```txt
R$95
```

Retorno:

```txt
R$195
```

Odd efetiva:

```txt
1.95
```

---

# 31. AUMENTO + COMISSÃO AO MESMO TEMPO

Ordem matemática recomendada:

```txt
Lucro base
   ↓
Aplicar aumento
   ↓
Aplicar comissão
   ↓
Lucro líquido
```

Fórmula:

```math
L =
S(O-1)
(1+A)
(1-C)
```

---

# 32. CASHBACK — SUPORTE OPCIONAL

Embora não seja prioridade, o BetTracker também apresenta o campo:

```txt
Cashback
```

Caso seja implementado como cashback em dinheiro sobre a stake perdida:

```txt
CB = percentual cashback
```

Se A vence e B perde:

```math
R_A =
S_1G_1
-
S_2
+
S_2CB_2
```

Se B vence e A perde:

```math
R_B =
S_2G_2
-
S_1
+
S_1CB_1
```

IMPORTANTE:

```txt
Cashback em dinheiro
```

e:

```txt
Cashback em freebet
```

não têm o mesmo valor econômico.

Se for freebet, primeiro deve ser convertido pelo módulo de freebet.

---

# 33. PROTEÇÃO BALANCEADA COM CASHBACK EM DINHEIRO

Quando houver cashback real:

```math
S_1G_1
-
S_2
+
S_2CB_2
=
S_2G_2
-
S_1
+
S_1CB_1
```

Logo:

```math
S_2
=
S_1
\frac{
G_1 + 1 - CB_1
}{
G_2 + 1 - CB_2
}
```

Sem cashback:

```txt
CB1 = 0
CB2 = 0
```

e voltamos para:

```math
S_2 =
\frac{S_1E_1}{E_2}
```

---

# 34. FREEBET — SEGUNDO FLUXO PRINCIPAL

O sistema também deve suportar:

```txt
Qualificar promoção
      ↓
Receber freebet
      ↓
Converter freebet
      ↓
Calcular lucro final
```

---

# 35. CUSTO PARA GERAR UMA FREEBET

A primeira operação pode não ser uma surebet positiva.

Exemplo:

```txt
Stake promocional = R$100
Odd promocional   = 1.90
Odd cobertura     = 2.00
```

A cobertura é calculada normalmente.

Caso a operação resulte em:

```txt
-R$5
```

esse valor é:

```txt
qualificationCost
```

---

# 36. FREEBET CUJA STAKE NÃO RETORNA

Para:

```txt
F  = valor da freebet
OF = odd da freebet
OH = odd de hedge
H  = stake do hedge
```

Lucro da freebet se vencer:

```math
F(O_F - 1)
```

Para equilibrar:

```math
H =
\frac{
F(O_F - 1)
}{
O_H
}
```

---

# 37. FREEBET COM AUMENTO E COMISSÃO

O mesmo conceito de odd efetiva pode ser utilizado.

Se a freebet possui:

```txt
Aumento
Comissão
```

o fator de lucro é:

```math
G_F =
(O_F - 1)
(1 + A_F)
(1 - C_F)
```

Como a stake da freebet não retorna:

```math
H =
\frac{
FG_F
}{
E_H
}
```

onde:

```txt
EH = odd efetiva do hedge
```

---

# 38. POR QUE A FÓRMULA DA FREEBET É DIFERENTE?

Uma aposta normal vencedora devolve:

```txt
stake + lucro
```

Uma freebet comum normalmente devolve:

```txt
somente lucro
```

Por isso não podemos usar diretamente:

```txt
effectiveOdd
```

da mesma forma para o lado da freebet.

Precisamos utilizar:

```txt
profitFactor
```

da freebet.

---

# 39. CONVERSÃO DA FREEBET

Resultado se freebet vence:

```math
R_F =
FG_F - H
```

Resultado se hedge vence:

```math
R_H =
HG_H
```

Onde:

```txt
GF = fator líquido de lucro da freebet
GH = fator líquido de lucro do hedge
```

Para balancear:

```math
FG_F - H =
HG_H
```

Logo:

```math
H =
\frac{
FG_F
}{
G_H + 1
}
```

Como:

```math
G_H + 1 = E_H
```

temos:

```math
\boxed{
H =
\frac{
FG_F
}{
E_H
}
}
```

---

# 40. FUNÇÃO DE CONVERSÃO DE FREEBET COMPLETA

```ts
export function convertFreebet({
  freebet,

  freebetOdd,
  freebetIncreasePercent = 0,
  freebetCommissionPercent = 0,

  hedgeOdd,
  hedgeIncreasePercent = 0,
  hedgeCommissionPercent = 0,
}: {
  freebet: number;

  freebetOdd: number;
  freebetIncreasePercent?: number;
  freebetCommissionPercent?: number;

  hedgeOdd: number;
  hedgeIncreasePercent?: number;
  hedgeCommissionPercent?: number;
}) {
  const fb = normalizeBet({
    odd: freebetOdd,
    increasePercent:
      freebetIncreasePercent,
    commissionPercent:
      freebetCommissionPercent,
  });

  const hedge = normalizeBet({
    odd: hedgeOdd,
    increasePercent:
      hedgeIncreasePercent,
    commissionPercent:
      hedgeCommissionPercent,
  });

  const theoreticalHedgeStake =
    (
      freebet *
      fb.profitFactor
    ) /
    hedge.effectiveOdd;

  const hedgeStake =
    roundMoney(
      theoreticalHedgeStake
    );

  const resultFreebetWins =
    roundMoney(
      freebet *
        fb.profitFactor -
      hedgeStake
    );

  const resultHedgeWins =
    roundMoney(
      hedgeStake *
      hedge.profitFactor
    );

  const convertedValue =
    Math.min(
      resultFreebetWins,
      resultHedgeWins
    );

  const conversionRatePercent =
    (
      convertedValue /
      freebet
    ) * 100;

  return {
    hedgeStake,

    resultFreebetWins,
    resultHedgeWins,

    convertedValue,
    conversionRatePercent,
  };
}
```

---

# 41. LUCRO FINAL DA PROMOÇÃO

```math
LucroFinal =
ValorConvertidoFreebet
-
CustoQualificacao
```

Exemplo:

```txt
Custo para conquistar freebet:
R$5,00

Freebet:
R$20,00

Valor convertido:
R$13,33

Lucro final:
R$8,33
```

---

# 42. ARREDONDAMENTO — REGRA OBRIGATÓRIA

Nunca utilizar apenas o valor teórico.

```ts
export function roundMoney(
  value: number
) {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}
```

Fluxo correto:

```txt
1. calcular stake teórica
2. arredondar para 2 casas
3. recalcular todos os cenários
4. usar os valores recalculados
```

---

# 43. PROTEÇÃO DE DUPLO APÓS ARREDONDAMENTO

```ts
const theoreticalStake2 =
  stake1 *
  effectiveOdd1 /
  effectiveOdd2;

const stake2 =
  roundMoney(
    theoreticalStake2
  );

const scenarioA =
  roundMoney(
    stake1 *
      profitFactor1 -
    stake2
  );

const scenarioB =
  roundMoney(
    stake2 *
      profitFactor2 -
    stake1
  );

const protectedResult =
  Math.min(
    scenarioA,
    scenarioB
  );
```

Isso representa o resultado protegido REAL.

---

# 44. OTIMIZAÇÃO DE CENTAVOS

Uma melhoria interessante é testar alguns centavos ao redor da stake teórica.

Exemplo:

```txt
Stake teórica = 115,0342
```

Testar:

```txt
115,00
115,01
115,02
115,03
115,04
115,05
...
```

e selecionar a stake que maximiza:

```ts
Math.min(
  scenarioA,
  scenarioB
)
```

Isso pode melhorar o lucro garantido em alguns centavos.

---

# 45. FUNÇÃO PARA OTIMIZAR A STAKE

```ts
export function optimizeHedgeStake({
  theoreticalStake,
  calculateScenarios,
}: {
  theoreticalStake: number;

  calculateScenarios:
    (stake: number) => {
      scenarioA: number;
      scenarioB: number;
    };
}) {
  const center =
    Math.round(
      theoreticalStake * 100
    );

  let best:
    | {
        stake: number;
        guaranteedResult: number;
      }
    | undefined;

  // testa ±10 centavos
  for (
    let cents = center - 10;
    cents <= center + 10;
    cents++
  ) {
    const stake =
      cents / 100;

    const {
      scenarioA,
      scenarioB,
    } = calculateScenarios(
      stake
    );

    const guaranteedResult =
      Math.min(
        scenarioA,
        scenarioB
      );

    if (
      !best ||
      guaranteedResult >
        best.guaranteedResult
    ) {
      best = {
        stake,
        guaranteedResult,
      };
    }
  }

  return best!;
}
```

---

# 46. ESTRUTURA FINAL DA PROTEÇÃO DE DUPLO

```ts
export interface DoubleProtectionResult {
  bet1: {
    stake: number;
    odd: number;

    increasePercent: number;
    commissionPercent: number;

    effectiveOdd: number;
    profitFactor: number;
  };

  bet2: {
    stake: number;
    odd: number;

    increasePercent: number;
    commissionPercent: number;

    effectiveOdd: number;
    profitFactor: number;
  };

  scenarioBet1Wins: number;
  scenarioBet2Wins: number;

  protectedResult: number;

  doubleGreenResult: number;

  totalStake: number;

  protectedROI: number;
  doubleGreenROI: number;
}
```

---

# 47. VALIDAÇÕES

Obrigatório:

```txt
stake > 0

odd > 1

aumento >= 0

0 <= comissão < 100
```

Bloquear:

```txt
NaN
Infinity
stake negativa
odd <= 1
comissão >= 100%
```

---

# 48. CONVERSÃO DOS PERCENTUAIS

Na interface:

```txt
30
```

significa:

```txt
30%
```

No cálculo:

```ts
const increase =
  30 / 100;

// 0.30
```

Comissão:

```txt
5
```

vira:

```ts
0.05
```

---

# 49. EXEMPLO COMPLETO DE PROTEÇÃO DE DUPLO

## Aposta A

```txt
Stake:     R$100
Odd:       2.10
Aumento:   30%
Comissão:  0%
```

Lucro base:

```txt
100 × 1.10
= 110
```

Lucro aumentado:

```txt
110 × 1.30
= 143
```

Odd efetiva:

```txt
1 + 1.43
= 2.43
```

---

## Aposta B

```txt
Odd:       2.00
Aumento:   0%
Comissão:  0%
```

Odd efetiva:

```txt
2.00
```

---

## Stake B

```txt
100 × 2.43 / 2.00
= R$121,50
```

---

## A ganha

```txt
Lucro A = R$143

Perda B = R$121,50

Resultado:
+R$21,50
```

---

## B ganha

```txt
Lucro B =
121,50 × 1

= R$121,50

Perda A =
R$100

Resultado:
+R$21,50
```

---

## Duplo Green

```txt
Lucro A:
R$143

Lucro B:
R$121,50
```

Resultado:

```txt
R$264,50
```

Resumo:

```txt
Resultado protegido:
+R$21,50

Duplo Green:
+R$264,50
```

---

# 50. EXEMPLO COM COMISSÃO

Aposta A:

```txt
Stake: R$100
Odd: 2.00
Aumento: 30%
Comissão: 5%
```

Lucro:

```txt
100 × (2-1)
× 1.30
× 0.95

= R$123,50
```

Retorno:

```txt
R$223,50
```

Odd efetiva:

```txt
2.235
```

Se o outro lado é:

```txt
Odd 2.00
```

Stake B:

```txt
100 × 2.235 / 2

= R$111,75
```

A vence:

```txt
123,50 - 111,75
= +R$11,75
```

B vence:

```txt
111,75 - 100
= +R$11,75
```

Duplo Green:

```txt
123,50 + 111,75
= R$235,25
```

---

# 51. ORDEM DE PRIORIDADE DE IMPLEMENTAÇÃO

## PRIORIDADE 1

```txt
Proteção de Duplo
```

Implementar:

```txt
Odd
Stake
Aumento
Comissão

Odd efetiva

Stake de proteção

Resultado lado A
Resultado lado B

Resultado protegido
Duplo Green

ROI protegido
ROI duplo green
```

---

## PRIORIDADE 2

```txt
Surebet comum
```

Com:

```txt
Aumento
Comissão
Odd efetiva
Stake fixa ou banca total
Lucro garantido
ROI
```

---

## PRIORIDADE 3

```txt
Conversão de freebet
```

Com:

```txt
Odd freebet
Aumento
Comissão

Odd hedge
Aumento
Comissão

Stake hedge
Valor convertido
Taxa de conversão
Lucro final
```

---

# 52. MODELO DE DOMÍNIO RECOMENDADO

```txt
src/
├── domain/
│   │
│   ├── bet/
│   │   ├── effective-odd.ts
│   │   ├── winning-profit.ts
│   │   └── types.ts
│   │
│   ├── double-protection/
│   │   ├── calculate.ts
│   │   ├── optimize-stake.ts
│   │   └── types.ts
│   │
│   ├── surebet/
│   │   ├── calculate.ts
│   │   └── types.ts
│   │
│   ├── promotion/
│   │   ├── qualification.ts
│   │   └── final-profit.ts
│   │
│   └── freebet/
│       ├── conversion.ts
│       └── types.ts
│
└── utils/
    └── money.ts
```

---

# 53. FÓRMULAS MAIS IMPORTANTES

## Odd efetiva

```math
\boxed{
E =
1 +
(O-1)(1+A)(1-C)
}
```

---

## Proteção de duplo

```math
\boxed{
S_2 =
\frac{
S_1E_1
}{
E_2
}
}
```

---

## Cenário A vence

```math
\boxed{
R_A =
S_1(E_1-1)-S_2
}
```

---

## Cenário B vence

```math
\boxed{
R_B =
S_2(E_2-1)-S_1
}
```

---

## Duplo Green

```math
\boxed{
R_{DG} =
S_1(E_1-1)
+
S_2(E_2-1)
}
```

---

## Surebet

```math
\boxed{
Q =
\frac1{E_1}
+
\frac1{E_2}
}
```

```txt
Q < 1
```

---

## Freebet

```math
\boxed{
H =
\frac{
FG_F
}{
E_H
}
}
```

---

# 54. REGRA CENTRAL DA APLICAÇÃO

Antes de realizar qualquer cálculo financeiro, transformar cada aposta normal em:

```txt
ODD EFETIVA
```

considerando:

```txt
Odd original
+
Aumento
-
Comissão
```

matematicamente através de:

```math
E =
1 +
(O-1)(1+A)(1-C)
```

Depois utilizar essa odd efetiva nos módulos de:

```txt
Proteção de Duplo
Surebet
Qualificação
Hedge
```

Para freebet, utilizar o **fator de lucro líquido**, pois a stake promocional normalmente não retorna.

---

# 55. OBSERVAÇÃO SOBRE COMPATIBILIDADE COM BETTRACKER

A calculadora pública do BetTracker atualmente apresenta os campos:

```txt
ODD
Comissão
Cashback
Aumento
Back
```

e a área:

```txt
Arbitragem
Proteção de Duplo
```

A modelagem deste README foi preparada para reproduzir matematicamente esse tipo de operação.

Entretanto, para validar uma compatibilidade **1:1** com a aba específica do BetTracker, ainda é recomendável executar testes de caixa-preta usando exemplos reais da interface e comparar:

```txt
stake calculada
resultado protegido
ROI
resultado de duplo green
efeito exato da comissão
efeito exato do aumento
```

Se houver diferença de centavos ou de regra, os exemplos da interface devem ser considerados a fonte final para ajustar o algoritmo.
