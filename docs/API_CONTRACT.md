# Contrato esperado da API

Prefixo sugerido: `/api/v1`.

## Autenticação

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/password-recovery
POST /auth/password-reset
```

As sessões usam cookie seguro e HTTP-only. CPF e e-mail apenas solicitam a recuperação; a troca da senha exige o token de uso único enviado por email.

## Casas e carteiras

```text
GET  /bookmaker-accounts
POST /bookmaker-accounts
GET  /bookmaker-accounts/:id
PATCH /bookmaker-accounts/:id
GET  /bookmaker-accounts/:id/transactions
POST /bookmaker-accounts/:id/deposits
POST /bookmaker-accounts/:id/withdrawals
POST /bookmaker-accounts/:id/adjustments
```

Criação, depósitos, saques e ajustes exigem o header `Idempotency-Key` (8 a 160 caracteres). Edição de metadados exige `version` no body. Valores monetários são strings decimais.

Exemplo de criação:

```json
{
  "name": "Bet365",
  "nickname": "Conta principal",
  "initialBalance": "500.00"
}
```

## Operações

```text
GET    /operations
POST   /operations
GET    /operations/:id
PATCH  /operations/:id
DELETE /operations/:id
POST   /operations/:id/settle
```

Exemplo reduzido para criação de surebet:

```json
{
  "type": "SUREBET",
  "eventName": "Palmeiras x Corinthians",
  "generatesBetCredit": true,
  "expectedBetCredit": "50.00",
  "notes": "Entrada ao vivo",
  "legs": [
    {
      "bookmakerAccountId": "account_1",
      "stake": "100.00",
      "odd": "3.0000",
      "commissionPercent": "0",
      "cashbackPercent": "0",
      "increasePercent": "0",
      "usesBetCredit": true,
      "creditSourceOperationId": "operation_qualifier_1"
    },
    {
      "bookmakerAccountId": "account_2",
      "stake": "115.38",
      "odd": "2.6000",
      "commissionPercent": "0",
      "cashbackPercent": "0",
      "increasePercent": "0"
    }
  ]
}
```

A resposta deve incluir `effectiveOdd`, `profitFactor`, resultados projetados, lucro garantido, ROI, total apostado e versão do motor de cálculo.

`creditSourceOperationId` só pode referenciar uma operação do mesmo usuário marcada com `generatesBetCredit=true`. Ao liquidar a operação consumidora, o backend deve concluir atomicamente o vínculo de crédito e o ciclo promocional da operação geradora, preservando o resultado financeiro individual de cada uma.

Para pernas com `usesBetCredit=true`, a stake promocional não retorna. O payout projetado é `stake × profitFactor`, enquanto uma aposta em dinheiro paga `stake × effectiveOdd`. A stake de crédito não compõe o capital real investido nem o ROI sobre caixa.

Na liquidação, todas as pernas precisam receber `WON` ou `LOST`, com ao menos uma vencedora. O lucro realizado é a soma dos payouts vencedores menos o capital real investido. Operações geradoras ligadas por `creditSourceOperationId` têm seu ciclo concluído na mesma transação.

Uma geradora cujo crédito foi concedido passa para `WAITING_CREDIT_USE` e recebe `creditGenerated=true`. Se não foi concedido, vai diretamente para `SETTLED`. Apenas créditos em espera podem ser selecionados. A consumidora retorna também `combinedPromotionProfit = consumerProfit + qualificationProfit`; agregações financeiras não devem somar esse campo novamente aos lucros individuais.

Criação, edição e liquidação devem atualizar carteiras em uma transação atômica. A criação debita stakes em dinheiro; a edição estorna a reserva anterior e aplica a nova; a liquidação credita os payouts vencedores. Stakes com crédito não debitam caixa. Cada efeito deve produzir uma movimentação idempotente vinculada à operação e à perna.

## Dashboard

```text
GET /dashboard/monthly?month=2026-08
```

Resposta esperada:

```json
{
  "month": "2026-08",
  "realizedProfit": "370.65",
  "realizedLoss": "28.40",
  "netResult": "342.25",
  "roiPercent": "7.82",
  "settledOperations": 12,
  "openStake": "292.30",
  "availableBalance": "3378.60",
  "dailyEvolution": [],
  "balancesByBookmaker": [],
  "recentOperations": []
}
```

Resultados mensais usam `settledAt`, e não a data de criação da operação.
