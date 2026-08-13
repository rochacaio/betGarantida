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
