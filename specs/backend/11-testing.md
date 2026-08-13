# 11 — Estratégia de testes

## Pirâmide

### Unitários

- Todas as fórmulas e exemplos numéricos de `README_Bet_Sem_Medo.md`.
- Odd efetiva com aumento e comissão.
- Payout em dinheiro versus crédito.
- Balanceamento de 2, 3 ou mais pernas.
- Arredondamento e otimização de centavos.
- ROI sem stake promocional.
- Transições de estado e validações puras.

### Integração com PostgreSQL real

- Repositórios, constraints e isolamento por usuário.
- Criação debita todas as contas atomicamente.
- Edição estorna e reaplica corretamente.
- Saldo insuficiente desfaz toda a transação.
- Liquidação credita somente vencedoras.
- Idempotência impede efeitos duplicados.
- Concorrência por saldo e crédito resulta em um único vencedor válido.
- Consumo fecha geradora e consumidora atomicamente.

### E2E

1. Cadastrar, restaurar sessão e sair.
2. Criar casa e conferir saldo/extrato.
3. Criar surebet normal, editar, liquidar e conferir dashboard.
4. Criar geradora e finalizar sem crédito.
5. Criar geradora, confirmar crédito, criar consumidora e finalizar ciclo.
6. Tentar acessar recurso de outro usuário.
7. Recuperar senha com token e invalidar sessões.

## Invariantes automatizadas

- Ledger e saldo em cache sempre reconciliam.
- Nenhum crédito possui mais de uma consumidora.
- Operação encerrada não possui perna pendente.
- Uma chave idempotente nunca representa payloads diferentes.
- Dashboard não soma `combinedPromotionProfit` aos lucros individuais.

## Qualidade mínima

- Testes críticos não usam mocks do Prisma.
- Datas e timezone são controladas nos testes.
- Fixtures financeiras usam strings/Decimal.
- Cada bug financeiro corrigido ganha teste de regressão.
- CI executa lint, tipos, unitários, integração, E2E essencial e validação OpenAPI.

