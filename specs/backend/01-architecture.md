# 01 — Arquitetura

## Objetivo

Implementar um monólito modular leve, simples de publicar e capaz de preservar consistência financeira.

## Estrutura pretendida

```text
apps/
  web/                       # interface existente
  api/                       # NestJS
packages/
  contracts/                 # schemas e cliente tipado
  calculation-engine/        # funções puras e testes de cálculo
```

Módulos do NestJS:

```text
auth, users, bookmaker-accounts, wallets,
operations, bet-credits, dashboard, audit, health
```

## Stack

- NestJS com API REST versionada em `/api/v1`.
- PostgreSQL com Prisma ORM.
- `Decimal` no domínio e `NUMERIC` no banco.
- OpenAPI gerado pela API; o frontend usa cliente gerado ou wrapper tipado.
- Sessão opaca em cookie seguro, armazenada no banco.
- Neon PostgreSQL e deploy do web/API na Vercel são o alvo inicial, sem acoplar o domínio ao provedor.
- O navegador acessa a API por `/api/v1` na origem do frontend; o Next.js encaminha para o projeto NestJS.

## Fronteiras

- Controllers validam transporte e chamam casos de uso.
- Casos de uso controlam autorização, transações e regras de estado.
- O motor de cálculo é puro, não acessa banco nem NestJS.
- Repositórios encapsulam Prisma.
- O dashboard consulta projeções/agregações, sem alterar domínio.

## Consistência

Uma única transação deve abranger operação, pernas, créditos e lançamentos afetados. Mutações recebem `Idempotency-Key`. Recursos editáveis possuem `version` para concorrência otimista.

## Decisões deliberadas

- Não usar microserviços, filas ou eventos distribuídos na primeira versão.
- Não usar saldo calculado ou informado pelo frontend.
- Não expor flags do protótipo como `stakesDebited` e `returnsCredited`; a existência de lançamentos idempotentes representa esses efeitos.
- Não permitir edição financeira livre de operações encerradas. Correções posteriores usam fluxo auditado de ajuste.
