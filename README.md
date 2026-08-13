# BetGarantida

Monorepo com frontend Next.js, API NestJS, Prisma/PostgreSQL, contratos e motor
de cálculo decimal.

## Desenvolvimento local

Suba um PostgreSQL de desenvolvimento ou use o serviço do arquivo de testes:

```bash
docker compose -f docker-compose.test.yml up -d
```

Crie `apps/api/.env` com, no mínimo:

```dotenv
DATABASE_URL=postgresql://betgarantida:betgarantida@localhost:5434/betgarantida_test
DIRECT_DATABASE_URL=postgresql://betgarantida:betgarantida@localhost:5434/betgarantida_test
APP_ORIGIN=http://localhost:3000
SESSION_SECRET=troque-por-um-segredo-local-longo
CPF_HASH_SECRET=troque-por-outro-segredo-local-longo
CPF_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
```

Depois:

```bash
npm install
npm run prisma:migrate:deploy --workspace betgarantida-api
npm run dev:api
```

Em outro terminal:

```bash
npm run dev:web
```

Acesse `http://localhost:3000`. O Next encaminha `/api/v1` para a API em
`http://localhost:3001`, preservando o cookie de sessão em mesma origem.

## Validação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Para a suíte PostgreSQL real, use exclusivamente um banco dedicado cujo nome
termine em `_test`, aplique as migrations e execute:

```bash
RUN_DB_INTEGRATION=1 npm run test:integration
```

O CI executa essa suíte com um PostgreSQL descartável.
