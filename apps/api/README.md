# BetGarantida API

Monólito modular NestJS do BetGarantida.

## Comandos

```bash
npm run dev:api
npm run build:api
npm run test:e2e --workspace betgarantida-api
```

A API local usa `http://localhost:3001/api/v1` e o OpenAPI fica em `http://localhost:3001/docs`.

Copie `.env.example` para `.env` antes de recursos que acessam PostgreSQL. O schema inicial não contém entidades; elas serão adicionadas na implementação da Spec 02.
