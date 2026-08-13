# BetGarantida Web

Frontend Next.js do BetGarantida, preparado para execução local e deploy nativo na Vercel.

## Desenvolvimento

```bash
cp .env.example .env.local
npm install
npm run dev
```

O frontend abre em `http://localhost:3000`. O rewrite de `/api/v1/*` encaminha as chamadas ao NestJS configurado em `API_ORIGIN`, que localmente usa `http://localhost:3001`.

## Validação

```bash
npm run typecheck
npm run lint
npm run build
```

## Vercel

Crie um projeto com Root Directory `apps/web` e configure:

```text
NEXT_PUBLIC_APP_URL=https://seu-frontend.vercel.app
API_ORIGIN=https://seu-backend.vercel.app
```

O navegador deve chamar somente caminhos relativos `/api/v1`. Isso mantém autenticação em mesma origem e deixa a Vercel encaminhar as requisições para o NestJS.
# BetGarantida Web

## Integração com a API

O frontend não usa dados demonstrativos nem `localStorage`. Todas as telas usam
a camada em `lib/api/client` e os módulos `features/*/api`. Em desenvolvimento,
o Next encaminha `/api/v1/*` para `API_ORIGIN`.

Para testar o fluxo completo, configure primeiro PostgreSQL/API conforme o
README da raiz e execute em terminais separados:

```bash
npm run dev:api
npm run dev:web
```

O navegador acessa `http://localhost:3000`; cookies permanecem em mesma origem
por causa do rewrite. O backend roda por padrão em `http://localhost:3001`.

Após mutações, o web recarrega contas, operações e dashboard da API. O editor
mantém cálculo local apenas para resposta imediata e usa `/operations/preview`
como resultado canônico antes da persistência.
