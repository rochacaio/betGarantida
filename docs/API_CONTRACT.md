# Contrato esperado da API

Prefixo sugerido: `/api/v1`.

## Autenticação

```text
POST /auth/register
POST /auth/login
POST /auth/recover-password
POST /auth/logout
GET  /auth/me
```

As sessões devem usar cookie seguro e HTTP-only. A recuperação simplificada por CPF e e-mail atende ao protótipo, mas deverá receber proteção contra abuso antes de produção.

## Casas e carteiras

```text
GET  /bookmaker-accounts
POST /bookmaker-accounts
GET  /bookmaker-accounts/:id
PATCH /bookmaker-accounts/:id
GET  /bookmaker-accounts/:id/transactions
POST /bookmaker-accounts/:id/transactions
```

Exemplo de criação:

```json
{
  "bookmakerName": "Bet365",
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
