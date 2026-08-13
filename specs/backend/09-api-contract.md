# 09 — Contrato da API

## Convenções

- Prefixo `/api/v1` e JSON.
- Valores decimais como strings; datas ISO 8601; enums em maiúsculas.
- Paginação por cursor: `data` e `pageInfo { nextCursor, hasNextPage }`.
- `Idempotency-Key` obrigatório em mutações financeiras.
- `version` obrigatório em edição, cancelamento e liquidação.
- Cookie de sessão; credenciais habilitadas no cliente.

## Endpoints

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/password-recovery
POST /auth/password-reset

GET  /bookmaker-accounts
POST /bookmaker-accounts
GET  /bookmaker-accounts/:id
PATCH /bookmaker-accounts/:id
GET  /bookmaker-accounts/:id/transactions
POST /bookmaker-accounts/:id/deposits
POST /bookmaker-accounts/:id/withdrawals
POST /bookmaker-accounts/:id/adjustments

POST /operations/preview
GET  /operations
POST /operations
GET  /operations/:id
PATCH /operations/:id
POST /operations/:id/cancel
POST /operations/:id/settle

GET  /bet-credits?status=AVAILABLE
GET  /dashboard/monthly?month=2026-08
GET  /health
```

## Exemplo de criação

```json
{
  "eventName": "Palmeiras x Corinthians",
  "notes": "Entrada ao vivo",
  "generatesBetCredit": true,
  "expectedBetCredit": "50.00",
  "legs": [
    {
      "bookmakerAccountId": "uuid",
      "stake": "100.00",
      "odd": "3.000000",
      "commissionPercent": "0",
      "cashbackPercent": "0",
      "increasePercent": "0",
      "usesBetCredit": false
    },
    {
      "bookmakerAccountId": "uuid",
      "stake": "115.38",
      "odd": "2.600000",
      "commissionPercent": "0",
      "cashbackPercent": "0",
      "increasePercent": "0",
      "usesBetCredit": false
    }
  ]
}
```

A resposta inclui a operação canônica, pernas, snapshot calculado, crédito e `version`.

## Exemplo de liquidação

```json
{
  "version": 3,
  "creditGenerated": true,
  "grantedCreditAmount": "50.00",
  "legs": [
    { "legId": "uuid-a", "result": "WON" },
    { "legId": "uuid-b", "result": "LOST" }
  ]
}
```

## Erros

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Saldo insuficiente para confirmar as entradas.",
    "fields": [{ "path": "legs.1.stake", "code": "INSUFFICIENT_BALANCE" }],
    "requestId": "uuid"
  }
}
```

Códigos mínimos: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `NOT_FOUND`, `CONFLICT`, `STALE_VERSION`, `INSUFFICIENT_BALANCE`, `INVALID_STATE_TRANSITION`, `BET_CREDIT_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`, `RATE_LIMITED`.

## Compatibilidade

Mudança incompatível exige nova versão. Campos podem ser adicionados de forma compatível. A especificação OpenAPI deve ser validada no CI e gerar os tipos usados pelo web.

