# Frontend BetGarantida

## Objetivo desta versão

O frontend valida a experiência do produto antes da implementação da API NestJS. Ele contém telas navegáveis, cálculos demonstrativos e persistência local temporária para casas de aposta e surebets.

Os dados do navegador são apenas mocks. O backend deverá substituir essa persistência e será a fonte de verdade para autenticação, autorização, saldos e cálculos financeiros.

## Telas e fluxos

### Autenticação

- Login com e-mail e senha.
- Cadastro com CPF, e-mail e senha.
- Recuperação com CPF, e-mail e nova senha.
- O login demonstrativo aceita qualquer combinação válida de campos.

### Dashboard

- Resultado mensal, lucro, perdas e ROI.
- Evolução visual do resultado.
- Saldo agregado e saldo por casa.
- Lista das entradas recentes.

Os valores do dashboard deverão ser retornados já agregados pelo backend. O frontend não deve baixar todo o histórico para calcular indicadores mensais.

### Casas de aposta

- Listagem das contas cadastradas pelo usuário.
- Saldo disponível, saldo em apostas e resultado mensal.
- Cadastro de casa com nome e saldo inicial.
- Entrada futura para extrato, depósitos, saques, transferências e ajustes.

### Surebets

- Histórico com estados `OPEN` e `SETTLED`.
- Busca, filtros e separação por status.
- Criação com duas ou mais pernas.
- Seleção independente de casa em cada perna.
- Campos de stake, odd, comissão, cashback e aumento.
- Edição de uma entrada existente.
- Resumo de investimento, retorno, lucro e ROI.

O próximo refinamento previsto adicionará qualificação de promoção, crédito de aposta recebido e uso de crédito em uma perna.

## Regras de integração

- Valores monetários são enviados como strings decimais, nunca como `float`.
- Percentuais são números na unidade exibida: `30` significa 30%.
- Datas são transmitidas em ISO 8601.
- Todo recurso financeiro pertence ao usuário da sessão. O frontend nunca envia um `userId` confiável.
- O backend recalcula odds efetivas, stakes, resultados e ROI antes de persistir.
- A resposta salva contém o snapshot calculado pelo servidor.
- Alterações em apostas liquidadas devem gerar revisão/auditoria.

## Estados de operação esperados

```text
DRAFT
OPEN
PARTIALLY_SETTLED
SETTLED
CANCELLED
```

## Estados de uma perna

```text
PENDING
WON
LOST
VOID
CASHOUT
PARTIAL_WIN
PARTIAL_LOSS
```

## Persistência temporária

O protótipo usa a chave `betgarantida-demo` no `localStorage`. Ela será removida quando a API estiver disponível. Senhas e CPF não são gravados localmente nesta versão.
