# 08 — Dashboard

`GET /dashboard/monthly?month=YYYY-MM` retorna dados agregados do usuário, na timezone configurada (`America/Sao_Paulo` inicialmente).

## Métricas

- `realizedProfit`: soma das parcelas positivas das bets e dos ganhos grátis lançados pelas casas.
- `realizedLoss`: perdas definitivas; não inclui qualificadoras com crédito disponível ou consumido.
- `creditGeneratingLoss`: perdas das qualificadoras cujo crédito está disponível ou foi consumido.
- `creditConversionProfit`: lucro das operações liquidadas que consumiram créditos originados por qualificadoras negativas.
- `freeWinnings`: ganhos grátis do mês (`BONUS_RECEIVED`).
- `netResult`: resultado líquido das operações mais os ganhos grátis.
- `contributedCapital`: soma histórica de saldos iniciais e depósitos.
- `roiPercent`: `netResult / contributedCapital × 100`.
- `settledOperations`: quantidade encerrada no mês.
- `openStake`: stakes em dinheiro ainda abertas.
- `availableBalance`: soma dos saldos disponíveis.
- `equity`: saldo disponível mais stakes abertas.

O mês das bets é determinado por `settledAt`, não por `createdAt`; ganhos grátis usam `occurredAt`. Operações `WAITING_CREDIT_USE` ainda não entram no resultado mensal, mas sua perda qualificadora aparece em `creditGeneratingLoss` enquanto o crédito estiver disponível. Quando concluídas, a geradora e a consumidora preservam seus lucros individuais; o combinado não é somado novamente.

## Séries e listas

- `dailyEvolution`: resultado líquido das bets e ganhos grátis por dia e acumulado.
- `balancesByBookmaker`: disponível, em aberto, patrimônio e resultado mensal.
- `recentOperations`: resumo das operações recentes.
- Comparação com mês anterior pode ser `null` quando não houver base.

## Regras

- Agregar no banco, sem baixar o histórico inteiro para o frontend.
- Filtros sempre incluem `userId` da sessão.
- Valores retornam como strings decimais.
- Dias sem movimento podem retornar zero para facilitar o gráfico.
