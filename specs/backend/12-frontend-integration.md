# 12 — Integração com o frontend

## Objetivo

Remover progressivamente `initialBookmakers`, `initialSurebets` e a chave `betgarantida-demo`, sem trocar tudo em uma única mudança arriscada.

## Camada cliente

Criar no web uma camada única de acesso:

```text
lib/api/client
features/auth/api
features/bookmakers/api
features/operations/api
features/dashboard/api
```

Componentes não chamam `fetch` diretamente. O cliente usa caminhos relativos `/api/v1`, envia cookies, trata o envelope de erros e usa tipos gerados do OpenAPI. O Next.js encaminha essas rotas ao NestJS por `API_ORIGIN`. Estado remoto pode usar TanStack Query; estado transitório do formulário continua local.

## Mapeamento de telas

| Tela | Leituras | Mutações |
| --- | --- | --- |
| Login/cadastro | `/auth/me` | register, login, logout |
| Recuperação | — | password-recovery, password-reset |
| Dashboard | `/dashboard/monthly` | — |
| Casas | contas e extrato | criar, editar, depositar, sacar, ajustar, transferir |
| Minhas entradas | lista e detalhe | editar, cancelar, liquidar |
| Nova surebet | casas e créditos disponíveis | preview e criar |

## Regras de UX da integração

- Após mutação, usar a resposta canônica do servidor e invalidar queries relacionadas.
- `STALE_VERSION` solicita recarga e preserva o rascunho do usuário quando possível.
- Erros `fields` apontam os controles e também alimentam o toastr.
- Loading bloqueia duplo clique, mas idempotência continua obrigatória no servidor.
- O seletor de crédito usa IDs de `BetCredit`, ainda exibindo evento e valor da geradora.
- O saldo mostrado após salvar vem da API, não de cálculo local.

## Fases de implementação

1. Scaffold do Nest, banco, contratos e motor de cálculo.
2. Autenticação e bootstrap de sessão no web.
3. Casas, ledger e remoção dos mocks de banca.
4. Preview, criação, listagem e edição de operações.
5. Liquidação e crédito de aposta.
6. Dashboard agregado.
7. Remover definitivamente localStorage e dados iniciais.

Durante a migração, uma flag local pode escolher mock ou API por domínio. Não é permitido misturar saldo mockado com operação real.

## Checklist de corte

- [ ] API e banco de desenvolvimento sobem com um comando documentado.
- [ ] Usuário autenticado vê somente seus dados.
- [ ] Todas as telas possuem loading, vazio e erro.
- [ ] Atualizar o navegador preserva sessão e dados.
- [ ] Saldos reconciliam após criar, editar, cancelar e liquidar.
- [ ] Ciclo de crédito completo funciona sem manipulação manual de banco.
- [ ] Dashboard usa apenas agregados da API.
- [x] `betgarantida-demo` e constantes demonstrativas foram removidos.
- [ ] Testes E2E críticos passam contra ambiente limpo.
