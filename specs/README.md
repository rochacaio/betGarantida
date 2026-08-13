# Especificações do BetGarantida

Esta pasta define o comportamento esperado do sistema antes da implementação do backend. Ela é a fonte de verdade funcional para substituir os mocks e o `localStorage` do frontend por uma API NestJS e PostgreSQL.

Antes de implementar uma nova spec, leia [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) para conhecer o estado real, decisões e pendências acumuladas.

## Princípios obrigatórios

- O backend é a fonte de verdade para autenticação, autorização, cálculos, saldos e estados.
- Dinheiro e percentuais trafegam como strings decimais e são processados com aritmética decimal.
- Toda alteração de saldo gera um lançamento imutável no ledger.
- Toda mutação financeira é atômica, idempotente e vinculada ao usuário autenticado.
- O frontend pode calcular previsões, mas sempre exibe o snapshot recalculado pelo servidor após salvar.
- Tipos do ORM não são contratos públicos da API.

## Mapa das specs

| Arquivo | Escopo |
| --- | --- |
| [backend/01-architecture.md](backend/01-architecture.md) | Arquitetura, módulos e decisões técnicas |
| [backend/02-domain-and-data.md](backend/02-domain-and-data.md) | Entidades, relações, estados e invariantes |
| [backend/03-authentication.md](backend/03-authentication.md) | Cadastro, login, sessão e recuperação de senha |
| [backend/04-bookmakers-and-wallets.md](backend/04-bookmakers-and-wallets.md) | Casas, saldos e ledger financeiro |
| [backend/05-calculation-engine.md](backend/05-calculation-engine.md) | Fórmulas, arredondamento e snapshots |
| [backend/06-operations.md](backend/06-operations.md) | Criação, edição, consulta e cancelamento de surebets |
| [backend/07-settlement-and-bet-credit.md](backend/07-settlement-and-bet-credit.md) | Liquidação e ciclo completo de crédito de aposta |
| [backend/08-dashboard.md](backend/08-dashboard.md) | Indicadores e agregações mensais |
| [backend/09-api-contract.md](backend/09-api-contract.md) | Convenções, endpoints e payloads |
| [backend/10-security-and-observability.md](backend/10-security-and-observability.md) | Segurança, auditoria, logs e operação |
| [backend/11-testing.md](backend/11-testing.md) | Estratégia e matriz de testes |
| [backend/12-frontend-integration.md](backend/12-frontend-integration.md) | Troca dos mocks pela API e ordem de entrega |
| [backend/13-vercel-deployment.md](backend/13-vercel-deployment.md) | Topologia, variáveis e regras de deploy na Vercel |

## Definição de pronto do backend

O backend estará pronto para substituir os mocks quando:

1. Todas as regras obrigatórias destas specs estiverem implementadas.
2. Os fluxos críticos da matriz de testes passarem em integração com PostgreSQL.
3. A API possuir OpenAPI atualizado e cliente tipado consumível pelo frontend.
4. Nenhuma tela depender de `initialBookmakers`, `initialSurebets` ou `betgarantida-demo`.
5. Repetir uma requisição financeira não produzir saldo, retorno ou liquidação duplicados.
