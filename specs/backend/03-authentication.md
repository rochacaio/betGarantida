# 03 — Autenticação

## Cadastro

`POST /auth/register` recebe email, CPF e senha.

Validações:

- email válido e normalizado;
- CPF válido após remoção da máscara;
- senha com no mínimo 8 caracteres e limite máximo seguro;
- email e CPF não cadastrados.

A senha usa Argon2id. A resposta cria uma sessão ou solicita login, decisão configurável; a primeira versão criará a sessão.

## Login

`POST /auth/login` recebe email e senha e retorna o usuário seguro. O cookie de sessão é host-only, `HttpOnly`, `Secure` em produção, `SameSite=Lax` e `Path=/`. O fluxo normal passa pelo rewrite de mesma origem do frontend; não definir o domínio do projeto da API no cookie. Erros não revelam se o email existe.

`GET /auth/me` restaura a sessão. `POST /auth/logout` revoga a sessão e limpa o cookie.

## Recuperação de senha

Conhecer CPF e email não autoriza trocar a senha diretamente.

1. `POST /auth/password-recovery` recebe CPF e email.
2. A resposta é sempre neutra.
3. Quando os dados correspondem, o backend envia token/código de uso único ao email.
4. `POST /auth/password-reset` recebe token e nova senha.
5. O token expira, é usado uma vez e todas as sessões anteriores são revogadas.

Deve haver rate limit por IP e identificador. Em ambiente local, um adaptador de email de desenvolvimento pode registrar o link no terminal, nunca em produção.

## Autorização

- Guard global exige sessão, exceto rotas públicas explicitamente marcadas.
- `userId` é extraído da sessão e nunca aceito do body/query como fonte de autorização.
- A ausência de propriedade de um recurso retorna `404`, evitando enumeração.

## Critérios de aceite

- Usuários distintos não conseguem ler IDs uns dos outros.
- Logout invalida a sessão no servidor.
- Alterar a senha invalida sessões existentes.
- CPF e senha nunca aparecem em logs, OpenAPI examples reais ou respostas.
