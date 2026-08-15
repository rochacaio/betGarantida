# 02 — Domínio e dados

Todos os IDs são UUIDs. Datas são UTC e respostas usam ISO 8601. Dinheiro usa `NUMERIC(19,2)` e odds/fatores/percentuais usam precisão mínima de seis casas.

## Entidades

### User

`id`, `email`, `cpfHash`, `cpfEncrypted`, `passwordHash`, `status`, `createdAt`, `updatedAt`.

- Email normalizado e único.
- CPF normalizado, validado e único por hash determinístico.
- CPF nunca aparece completo em respostas comuns.

### Session e PasswordResetToken

Tokens são armazenados somente como hash, possuem expiração, revogação e data de uso.

### BookmakerAccount

`id`, `userId`, `name`, `nickname`, `currency`, `status`, `cachedBalance`, `version`, timestamps.

### WalletTransaction

`id`, `userId`, `bookmakerAccountId`, `operationId?`, `legId?`, `type`, `amount`, `idempotencyKey`, `occurredAt`, `metadata`, `createdAt`.

Tipos iniciais: `INITIAL_BALANCE`, `DEPOSIT`, `WITHDRAWAL`, `BET_STAKE`, `BET_RETURN`, `BET_REFUND`, `BONUS_RECEIVED`, `BONUS_USED`, `ADJUSTMENT`.

O valor é assinado: entrada positiva e saída negativa. Lançamentos são imutáveis.

### Operation

`id`, `userId`, `sequenceNumber`, `type`, `eventName`, `notes`, `status`, `generatesBetCredit`, snapshots projetados e realizados, `version`, `openedAt`, `settledAt?`, timestamps.

Na primeira versão, `type = SUREBET`.

Estados:

```text
OPEN -> SETTLED
OPEN -> WAITING_CREDIT_USE -> SETTLED
OPEN -> CANCELLED
```

`DRAFT` poderá ser incluído quando a interface oferecer salvamento incompleto. `PARTIALLY_SETTLED` fica fora da primeira versão porque a tela atual exige resultado de todas as pernas.

### BetLeg

`id`, `operationId`, `bookmakerAccountId`, `position`, `betType`, `stake`, `riskAmount`, `odd`, `commissionPercent`, `cashbackPercent`, `increasePercent`, `usesBetCredit`, `usesFreeBetCredit`, `result`, snapshots de cálculo e timestamps.

`betType` pode ser `BACK` ou `LAY`. Em `BACK`, `riskAmount = stake`. Em `LAY`,
`stake` representa o ganho bruto oferecido na bolsa e `riskAmount` representa a
responsabilidade realmente reservada: `stake × (odd - 1)`.

Resultados iniciais: `PENDING`, `WON`, `LOST`. `VOID`, `CASHOUT` e resultados parciais exigirão regras financeiras próprias antes de serem habilitados.

### BetCredit

`id`, `userId`, `sourceOperationId`, `expectedAmount`, `grantedAmount?`, `status`, `consumerOperationId?`, `consumedAt?`, timestamps.

Estados: `EXPECTED`, `AVAILABLE`, `NOT_GRANTED`, `CONSUMED`, `EXPIRED`, `CANCELLED`.

## Invariantes

- Todo recurso consultado ou alterado pertence ao usuário da sessão.
- Operação possui no mínimo duas pernas.
- Conta da casa deve estar ativa e pertencer ao usuário.
- Stake e crédito são maiores que zero; odd é maior que 1.
- Comissão fica entre 0 e 100; cashback e aumento não podem ser negativos.
- Linhas `LAY` não usam crédito de aposta, cashback ou aumento; sua comissão é
  aplicada ao lucro da bolsa.
- Uma perna com crédito referencia exatamente um `BetCredit AVAILABLE` do usuário.
- Um crédito só pode ser consumido uma vez.
- A soma dos lançamentos de uma conta deve reconciliar com `cachedBalance`.
- `settledAt` é preenchido apenas quando o ciclo financeiro da operação termina.
- `combinedPromotionProfit` é uma projeção de leitura, nunca um novo lançamento ou lucro somável.

## Índices e restrições essenciais

- Únicos: email normalizado, hash de CPF, `(userId, sequenceNumber)`, `sourceOperationId` em BetCredit e chaves idempotentes no respectivo escopo.
- Índices: operações por `(userId, status, createdAt)`, por `(userId, settledAt)`, ledger por `(bookmakerAccountId, occurredAt)` e créditos por `(userId, status)`.
- Chave estrangeira de `consumerOperationId` e bloqueio transacional ao consumir crédito.
