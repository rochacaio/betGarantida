# 08 — Dashboard

`GET /dashboard/monthly?month=YYYY-MM` retorna dados agregados do usuário, na timezone configurada (`America/Sao_Paulo` inicialmente).

## Métricas

- `realizedProfit`: soma das parcelas positivas dos lucros realizados.
- `realizedLoss`: valor absoluto da soma das parcelas negativas.
- `netResult`: soma dos lucros realizados.
- `roiPercent`: `netResult / realCashInvestmentSettled × 100`.
- `settledOperations`: quantidade encerrada no mês.
- `openStake`: stakes em dinheiro ainda abertas.
- `availableBalance`: soma dos saldos disponíveis.
- `equity`: saldo disponível mais stakes abertas.

O mês é determinado por `settledAt`, não por `createdAt`. Operações `WAITING_CREDIT_USE` ainda não entram como concluídas no resultado mensal. Quando concluídas, a geradora e a consumidora preservam seus lucros individuais; o combinado não é somado novamente.

## Séries e listas

- `dailyEvolution`: resultado líquido por dia e acumulado.
- `balancesByBookmaker`: disponível, em aberto, patrimônio e resultado mensal.
- `recentOperations`: resumo das operações recentes.
- Comparação com mês anterior pode ser `null` quando não houver base.

## Regras

- Agregar no banco, sem baixar o histórico inteiro para o frontend.
- Filtros sempre incluem `userId` da sessão.
- Valores retornam como strings decimais.
- Dias sem movimento podem retornar zero para facilitar o gráfico.

