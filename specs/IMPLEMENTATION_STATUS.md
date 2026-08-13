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
- Ajuste de banca define o novo saldo final e lança no ledger apenas a diferença; depósito permanece aditivo e saque permanece subtrativo.
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
- Prisma validate/generate, lint, typecheck, build, 66 testes da API, 18 testes do motor e 2 E2E passaram após as Specs 7–9.

Pendências deliberadas:

- As transações, locks, constraints e novas migrations ainda precisam ser aplicados e exercitados em PostgreSQL real quando o banco de teste/Neon for configurado.
- Liquidação, crédito concedido/não concedido, consumo definitivo e resultado promocional combinado pertencem à Spec 07.
- O frontend continua mockado e será conectado aos contratos canônicos na Spec 12.

## Spec 07 — Liquidação e crédito de aposta

Status: implementada e validada sem banco externo.

- `POST /operations/:id/settle` exige operação `OPEN`, `version`, resultados completos, ao menos um green e `Idempotency-Key`.
- Payouts vencedores e cashback em dinheiro das linhas perdedoras são recalculados pelo servidor e creditados na casa correspondente uma única vez.
- Operações geradoras exigem a decisão sobre o crédito: `NOT_GRANTED` encerra normalmente; `AVAILABLE` aceita valor real diferente do esperado e move a operação para `WAITING_CREDIT_USE`.
- Operações consumidoras validam novamente a reserva, marcam o crédito `CONSUMED` e encerram geradora e consumidora atomicamente.
- Resultado promocional combinado é retornado como visão, somando os lucros individuais sem gerar ledger adicional.
- `GET /bet-credits?status=AVAILABLE` retorna somente créditos do usuário ainda não reservados para alimentar o seletor do frontend.

Pendências deliberadas:

- Concorrência e rollback integral precisam ser exercitados contra PostgreSQL real; a implementação usa locks e transação `SERIALIZABLE` com retry.
- Expiração automática de créditos pertence à rotina operacional/observabilidade posterior.

## Spec 08 — Dashboard

Status: implementada e validada sem banco externo.

- `GET /dashboard/monthly?month=YYYY-MM` agrega diretamente no PostgreSQL e sempre filtra pelo usuário autenticado.
- Métricas incluem ganhos, perdas, resultado líquido, investimento encerrado, ROI, quantidade encerrada, stake aberta, saldo disponível e patrimônio.
- O mês usa `settledAt` na timezone `America/Sao_Paulo`; `WAITING_CREDIT_USE` não entra no resultado.
- Série diária retorna todos os dias do mês, inclusive dias zerados, com resultado e acumulado.
- Resumo por casa inclui disponível, aberto, patrimônio e resultado mensal derivado do ledger.
- Operações recentes e valores decimais serializados como strings fazem parte da resposta.
- Comparação com o mês anterior permanece `null` nesta primeira versão, como permitido pela spec quando não há base comparável.

Pendências deliberadas:

- Validar planos e performance das queries com volume real no Neon e adicionar índices específicos apenas se as métricas mostrarem necessidade.

## Spec 09 — Contrato da API

Status: implementada e validada.

- Prefixo, cookie, strings decimais, datas ISO, enums e paginação por cursor permanecem alinhados ao contrato.
- Todas as mutações financeiras de operações agora exigem `Idempotency-Key`; o registro de comando e seus efeitos são atômicos.
- Repetição com mesmo hash não duplica efeitos; chave reutilizada com conteúdo diferente retorna `IDEMPOTENCY_CONFLICT`.
- Corridas na unicidade da chave são repetidas e resolvidas como replay dentro da política transacional.
- Filtro global padroniza erros em `error { code, message, fields?, requestId }` e devolve `X-Request-Id`.
- Validação de DTOs mantém caminhos completos para erros de campos aninhados.
- `@betgarantida/contracts` expõe convenções compartilhadas de operação, paginação, dashboard, enums e erros; Swagger continua disponível em `/docs`.
- Typecheck dos contratos, lint/typecheck/build da API, 66 testes da API, 18 do motor e 2 E2E passaram.

Pendências deliberadas:

- Geração automática dos tipos web a partir do OpenAPI e validação do documento em CI serão conectadas junto da integração do frontend/CI nas Specs 11 e 12. Os contratos manuais atuais já refletem os endpoints implementados.

## Spec 10 — Segurança e observabilidade

Status: implementada e validada sem serviços externos.

- Whitelist/validação de DTOs, Helmet, limite de payload, CORS restrito, cookies seguros, Argon2id, hashes de tokens e criptografia de CPF permanecem ativos.
- Middleware de mesma origem bloqueia mutações autenticadas cujo `Origin` difere de `APP_ORIGIN`, protegendo o cookie contra CSRF.
- `requestId` é validado/gerado no início da requisição, propagado por `AsyncLocalStorage`, header, erros, logs e auditoria.
- Logs estruturados JSON contêm apenas método, rota, status, duração, requestId e referência pseudonimizada do usuário; não registram body, query sensível, cookie, CPF, senha ou token.
- Auditoria cobre cadastro, login, troca de senha, operações financeiras e eventos de expectativa, reserva, concessão, negativa e consumo de crédito.
- `/health` verifica o processo; `/health/readiness` consulta o banco; `/health/metrics` expõe contadores locais de requisições, erros, taxa de erro e latência média.
- Reconciliação continua sem correção silenciosa; migrations permanecem comando separado do startup.

Pendências deliberadas:

- Métricas locais reiniciam com a função serverless. Exportação para observabilidade externa e alertas persistentes pertencem à configuração de produção.
- Backups e usuário PostgreSQL de menor privilégio dependem do provedor escolhido na Spec 13.

## Spec 11 — Estratégia de testes

Status: implementada; suíte PostgreSQL preparada e não executada localmente nesta sessão.

- CI do GitHub sobe PostgreSQL 17 descartável, aplica migrations e executa lint, tipos, unitários, integração e build completo.
- Suíte `financial.integration-spec.ts` usa Prisma/repositório reais e cobre débito atômico, replay idempotente e estorno com reconciliação de saldo.
- A suíte exige `RUN_DB_INTEGRATION=1` e recusa banco cujo nome não termine em `_test`, reduzindo risco contra dados reais.
- `docker-compose.test.yml` e README da raiz documentam banco e comandos locais.
- 68 testes da API cobrem operações, créditos, dashboard, validação, autenticação, carteira e proteção CSRF/requestId; os 18 testes do motor permanecem aprovados.
- Builds de produção do Nest e Next e os E2E sem banco passaram.

Pendências deliberadas:

- Nesta sessão não havia PostgreSQL/Docker ativo; portanto, a nova suíte real foi validada por typecheck/lint e será executada no CI ou após subir o serviço documentado.
- Ampliar a suíte real para concorrência de crédito, liquidação e isolamento completo entre usuários continua recomendado antes do primeiro uso financeiro em produção.

## Spec 12 — Integração com o frontend

Status: implementada e validada por lint, typecheck e build de produção.

- Camada única `lib/api/client` trata cookies, envelopes de erro e comandos idempotentes; módulos `features/auth`, `bookmakers`, `operations` e `dashboard` concentram chamadas HTTP.
- Login, cadastro, restauração de sessão, logout, recuperação e redefinição por token usam a API real.
- Casas, saldos, operações, edição, liquidação, créditos disponíveis e dashboard usam respostas canônicas do backend.
- O editor usa preview autoritativo com debounce e mantém cálculo local apenas para resposta visual imediata.
- Após mutações financeiras, contas, operações e dashboard são recarregados; o frontend não altera saldos localmente.
- Surebets em `WAITING_CREDIT_USE` permitem corrigir o valor concedido enquanto o crédito estiver disponível e sem reserva; a correção é auditada e versionada.
- Mutações de autenticação, casas, saldos, transferências e surebets exibem toast de sucesso ou erro com a mensagem devolvida pela API.
- Dados demonstrativos, `initialBookmakers`, `initialSurebets`, flags financeiras locais e `betgarantida-demo` foram removidos.
- Estados iniciais de carregamento, listas vazias e erros de autenticação/mutação estão cobertos; `STALE_VERSION` preserva o drawer/rascunho porque a mutação rejeitada não desmonta o editor.
- Rewrite por `API_ORIGIN` mantém cookies em mesma origem e está alinhado ao deploy na Vercel.

Pendências deliberadas:

- O web usa tipos públicos mantidos na camada de feature. Geração automática a partir do OpenAPI continua recomendada no endurecimento do CI, sem bloquear o contrato atual.
- Extrato detalhado, depósito, saque e ajuste já têm API, mas a tela visual atual ainda só apresenta o resumo da casa; completar essas interações quando a interface correspondente for desenhada.
- O ciclo E2E visual completo depende do PostgreSQL de desenvolvimento ativo e deve ser executado antes do deploy.
