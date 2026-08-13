# Estado da implementação

Este arquivo deve ser lido antes de iniciar a próxima spec. Ele registra o que já foi entregue, decisões tomadas e pendências conhecidas.

## Spec 01 — Arquitetura

Status: implementada e validada.

- Workspace npm na raiz com `apps/web`, `apps/api`, `packages/contracts` e `packages/calculation-engine`.
- NestJS com prefixo `/api/v1`, OpenAPI em `/docs`, validação global, Helmet e CORS.
- Módulos de domínio criados e endpoint `GET /api/v1/health` coberto por E2E.
- Prisma preparado para PostgreSQL/Neon.
- Build, typecheck, lint, teste E2E e validação Prisma passaram.

Pendências deliberadas:

- Controllers e casos de uso dos módulos serão implementados nas specs de cada domínio.
- O pacote `@nestjs/swagger` possui advisory transitivo no parser `js-yaml`. A aplicação não aceita YAML do usuário e a API apenas gera documentação a partir de metadados internos. Monitorar e atualizar assim que a dependência oficial corrigida estiver disponível.

## Regra de atualização

Ao concluir cada spec, registrar aqui o status, testes executados, decisões e qualquer pendência deliberada.

## Spec 02 — Domínio e dados

Status: implementada e validada estaticamente.

- Schema Prisma contém usuários, sessões, recuperação de senha, casas, ledger, operações, pernas e créditos.
- IDs UUID, datas com timezone, dinheiro `NUMERIC(19,2)` e fatores/percentuais com seis casas.
- Relações, enums, índices, unicidades, controle de versão e deleções restritivas configurados.
- Migration PostgreSQL inicial gerada com constraints adicionais para normalização, valores, odds, percentuais, liquidação e crédito.
- `DatabaseModule` global e ciclo de vida do `PrismaService` configurados.
- Prisma validate/generate, lint, typecheck, build, 18 testes estruturais e E2E passaram.

Pendências deliberadas:

- A migration ainda não foi aplicada a uma instância PostgreSQL porque nenhuma `DATABASE_URL` real/local foi configurada. Aplicar e testar a migration na primeira configuração do Neon ou banco local, antes de dados reais.
- Regras entre múltiplas linhas/tabelas — mínimo de duas pernas, propriedade pelo mesmo usuário, saldo, transições e disponibilidade do crédito — serão garantidas pelos casos de uso transacionais nas specs 4, 6 e 7.
- Repositórios específicos de cada agregado serão criados com seus casos de uso; controllers não devem acessar `PrismaService` diretamente.

## Spec 03 — Autenticação

Status: implementada e validada sem banco externo.

- Cadastro com email normalizado, CPF validado, Argon2id, CPF cifrado em AES-256-GCM e hash HMAC para unicidade.
- Login com erro neutro, proteção de timing para usuário inexistente e sessão opaca armazenada somente por hash.
- Cookie host-only `HttpOnly`, `SameSite=Lax`, `Secure` em produção e `Path=/`.
- Guard global por sessão; apenas rotas `@Public()` ficam abertas. `/auth/me` e logout usam o usuário da sessão.
- Recuperação em duas etapas, token de uso único/expirável, revogação das sessões e resposta neutra.
- Email local registra o link no terminal; produção usa Resend e não devolve token na API.
- Rate limit persistente por IP e identificador, adequado ao runtime serverless.
- Variáveis críticas são validadas antes do bootstrap em produção.
- Prisma validate/generate, lint, typecheck, build, 37 testes unitários/estruturais e E2E do health passaram.

Pendências deliberadas:

- A migration de rate limit e as tabelas anteriores ainda precisam ser aplicadas/testadas em PostgreSQL real quando o Neon ou banco local for configurado.
- A tela atual de recuperação ainda representa o protótipo antigo. Na integração com a API, ela deverá primeiro solicitar email/CPF e depois aceitar token + nova senha (por link recebido no email).
- Usuários distintos e revogação real foram cobertos na camada de serviço/contrato; o E2E completo contra PostgreSQL será adicionado quando houver banco de teste.
- A tabela de rate limit precisará de limpeza periódica de registros antigos na etapa de operação/observabilidade.

## Spec 04 — Casas e carteiras

Status: implementada e validada sem banco externo.

- CRUD de metadados das contas com isolamento por usuário, arquivamento e concorrência otimista por `version`.
- Criação gera `INITIAL_BALANCE` no ledger, inclusive quando o saldo inicial é zero; saldo não é editado diretamente.
- Depósitos, saques e ajustes usam strings decimais, `Idempotency-Key` e atualizam ledger + `cachedBalance` atomicamente.
- Movimentações bloqueiam a conta com `SELECT ... FOR UPDATE` e usam transação `SERIALIZABLE` com retry para impedir gastos concorrentes acima do saldo.
- Replays retornam o efeito original; chave reutilizada com payload diferente gera `IDEMPOTENCY_CONFLICT`.
- Ajustes exigem motivo e geram `AuditLog` na mesma transação.
- Extrato usa cursor, saldo por casa retorna disponível, stake aberta e patrimônio.
- Rotina interna de reconciliação compara soma do ledger com cache sem corrigir divergência silenciosamente.
- Casas arquivadas preservam histórico e recusam novas movimentações financeiras.
- Prisma validate/generate, lint, typecheck, build, 44 testes unitários/estruturais e E2E passaram.

Pendências deliberadas:

- As migrations, locks e transações `SERIALIZABLE` ainda precisam ser exercitados em PostgreSQL real quando o banco de teste/Neon for configurado.
- `BET_STAKE`, `BET_REFUND`, `BET_RETURN` e `BONUS_USED` já existem no ledger, mas serão gravados pelos casos de uso das Specs 6 e 7 dentro da mesma transação da operação. Eles não devem chamar uma transação de carteira separada.
- Resultado mensal por casa será implementado com o dashboard na Spec 8.
- A rotina de reconciliação é interna; agendamento, alerta e endpoint administrativo pertencem à Spec 10.
