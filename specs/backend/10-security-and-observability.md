# 10 — Segurança e observabilidade

## Segurança

- Validar DTOs com whitelist e rejeitar campos desconhecidos em mutações sensíveis.
- O frontend usa rewrite de mesma origem para a API. Quando a API for acessada diretamente, CORS fica restrito à origem configurada e aceita credenciais.
- Proteção CSRF quando arquitetura/origem exigir.
- Helmet, limites de payload e rate limits em autenticação e recuperação.
- Segredos somente em variáveis de ambiente.
- Senhas com Argon2id; tokens somente como hash.
- CPF cifrado em repouso, mascarado em leitura e excluído de logs.
- Não registrar cookies, Authorization, senha, CPF, tokens ou bodies sensíveis.
- Backups, migrations revisadas e princípio de menor privilégio no banco.

## Auditoria

Registrar ator, ação, recurso, versão anterior/nova, requestId, data e metadados seguros para:

- login relevante e mudanças de senha;
- ajustes manuais de banca;
- criação, edição, cancelamento e liquidação;
- geração, reserva e consumo de crédito.

Audit log não substitui ledger e não deve armazenar segredo.

## Observabilidade

- Logs JSON com `requestId`, rota, status, duração e userId pseudonimizado.
- Endpoint `/health` verifica processo; readiness pode verificar banco.
- Métricas: taxa de erro, latência, falhas de login, conflitos, divergências de reconciliação e duração das transações.
- Erros inesperados podem ser enviados a um serviço externo futuramente.

## Operação

- Migrations executadas separadamente do startup serverless.
- Job periódico de reconciliação do ledger alerta divergências e nunca as corrige silenciosamente.
- Ambiente de produção começa sem usuário ou dados demonstrativos.
