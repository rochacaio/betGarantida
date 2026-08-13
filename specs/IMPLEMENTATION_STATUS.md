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

## Spec 05 — Motor de cálculo

Status: implementada e validada.

- Pacote puro `@betgarantida/calculation-engine`, sem dependência de NestJS, Prisma ou navegador.
- Cálculos usam `Decimal` com precisão ampliada e `ROUND_HALF_UP`; dinheiro e stakes persistíveis são arredondados para centavos e os cenários são recalculados depois do arredondamento.
- Suporta aumento sobre lucro, comissão sobre lucro, cashback em dinheiro, stakes manuais/automáticas, duas ou mais linhas e múltiplas linhas vencedoras.
- Crédito de aposta usa `profitFactor`, não devolve a stake e não compõe investimento real nem denominador de ROI.
- Balanceamento com cashback segue `payoutMultiplier - cashbackPercent/100`, conforme o README matemático.
- Snapshot expõe resultados por cenário, retorno protegido, lucro, ROI, índice de arbitragem, política de arredondamento e `engineVersion` `1.0.0`.
- Conversão de freebet, lucro líquido da promoção, liquidação e otimizador de centavos estão disponíveis como funções puras.
- Valores `Decimal` podem ser serializados como strings para contratos JSON, sem perda por ponto flutuante.
- Build, typecheck e 18 testes determinísticos do pacote passaram; a API anterior continuou compilando e passando seus testes.

Pendências deliberadas:

- A Spec 06 deve chamar este motor no servidor para preview e escrita, ignorar campos calculados pelo cliente e persistir o snapshot/versionamento retornado.
- Cashback suportado nesta versão é retorno em dinheiro. Cashback concedido como crédito deve ser modelado pelo fluxo de créditos da Spec 07, sem tratá-lo como caixa.
- A interface ainda mantém cálculos locais do protótipo. Na integração, eles podem servir como resposta visual imediata, mas o resultado canônico será sempre o recalculado pela API.

## Spec 06 — Operações de surebet

Status: implementada e validada sem banco externo.

- Endpoints autenticados de preview, criação, listagem, detalhe, edição e cancelamento implementados em `/api/v1/operations`.
- Preview progressivo aceita linhas automáticas sem stake e não exige evento/casa; criação e edição exigem evento e ao menos duas pernas completas.
- O servidor ignora cálculos do cliente, usa o motor da Spec 05 e persiste o snapshot canônico completo, `engineVersion` e campos resumidos.
- Criação bloqueia contas, valida propriedade/status, agrega stakes por casa, verifica saldos e grava operação, pernas, débitos e crédito `EXPECTED` em transação `SERIALIZABLE` com retry.
- Crédito usado precisa estar `AVAILABLE`, pertencer ao usuário, ter valor integral compatível e não possuir consumidor; ele fica reservado pela operação sem ser consumido antes da liquidação.
- Edição financeira aceita apenas `OPEN`, exige `version`, preserva stakes manuais e reconcilia atomicamente ledger, saldos, pernas e reservas de crédito.
- Edições preservam histórico por `BET_REFUND` + novo `BET_STAKE`; a FK de uma movimentação para uma perna substituída usa `ON DELETE SET NULL`.
- Cancelamento aceita apenas `OPEN`, exige `version`, estorna caixa, libera créditos reservados, cancela crédito esperado e cria auditoria na mesma transação.
- Lista usa cursor, ordem decrescente e filtros por status, período, casa e evento; todas as consultas incluem o usuário autenticado.
- Erros de validação globais agora expõem caminhos completos, inclusive `legs.1.odd`, para campos e toastrs do frontend.
- Prisma validate/generate, lint, typecheck, build, 61 testes da API, 18 testes do motor e 2 E2E passaram.

Pendências deliberadas:

- As transações, locks, constraints e novas migrations ainda precisam ser aplicados e exercitados em PostgreSQL real quando o banco de teste/Neon for configurado.
- Liquidação, crédito concedido/não concedido, consumo definitivo e resultado promocional combinado pertencem à Spec 07.
- `Idempotency-Key` para as mutações financeiras de operações será uniformizado na implementação do contrato transversal da Spec 09; a Spec 07 já exige idempotência específica para liquidação.
- O frontend continua mockado e será conectado aos contratos canônicos na Spec 12.
