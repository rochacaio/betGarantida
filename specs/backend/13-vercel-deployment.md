# 13 — Deploy gratuito na Vercel

## Topologia

O mesmo repositório origina dois projetos Vercel:

```text
betgarantida-web -> Root Directory apps/web
betgarantida-api -> Root Directory apps/api
```

O PostgreSQL fica no Neon e emails transacionais no Resend. Nenhum processo depende de disco persistente, memória entre requisições ou worker contínuo.

## Web

Variáveis:

```text
NEXT_PUBLIC_APP_URL=https://<web>
API_ORIGIN=https://<api>
```

O Next.js reescreve `/api/v1/:path*` para `${API_ORIGIN}/api/v1/:path*`. O código do navegador sempre usa URL relativa. `API_ORIGIN` não usa prefixo `NEXT_PUBLIC_` e não deve ser incorporada ao bundle cliente.

## API

Variáveis mínimas:

```text
NODE_ENV=production
DATABASE_URL=<Neon pooled URL>
DIRECT_DATABASE_URL=<Neon direct URL>
SESSION_SECRET=<segredo aleatório>
APP_ORIGIN=https://<web>
RESEND_API_KEY=<segredo>
EMAIL_FROM=<remetente verificado>
```

- `DATABASE_URL` atende o runtime serverless.
- `DIRECT_DATABASE_URL` é usada somente pelo Prisma Migrate em CI/deploy controlado.
- A API confia nos headers do proxy somente dentro da plataforma configurada.
- Migrations nunca rodam durante o bootstrap de uma Function.

## Cookies e proxy

Como o navegador acessa `/api/v1` na origem do frontend, o cookie de sessão é host-only, `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`. Não definir `Domain=.vercel.app` nem o domínio do projeto da API.

O NestJS pode manter CORS restrito para ferramentas e acesso direto, mas o caminho normal não depende de CORS. Headers `Set-Cookie` devem atravessar o rewrite sem alteração de domínio.

## Restrições serverless

- Não gravar uploads ou banco no filesystem da Function.
- Não guardar sessão, idempotência ou cache financeiro apenas em memória.
- Não usar `setInterval`, consumidores permanentes ou cron dentro do processo.
- Inicializar Prisma uma vez por instância quente e usar conexão pooled.
- Manter transações curtas e evitar dependências de runtime desnecessárias.
- Jobs futuros usam Vercel Cron chamando endpoint autenticado e idempotente.

## Deploy e migrations

1. Validar testes e build.
2. Executar `prisma migrate deploy` com a conexão direta em etapa controlada.
3. Publicar a API.
4. Executar smoke test de `/health`.
5. Publicar o web e validar `/api/v1/auth/me` pela URL do frontend.

Preview deployments devem usar banco/branch de preview separado ou permanecer sem migrations destrutivas. Nunca apontar testes E2E para produção.

## Limites e evolução

O plano Hobby serve ao uso pessoal inicial. Alertas devem acompanhar consumo da Vercel, Neon e Resend. Ao se tornar uso comercial ou exceder limites, a aplicação pode migrar o NestJS para container sem alterar contratos ou domínio.
