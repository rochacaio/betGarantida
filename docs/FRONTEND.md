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
- Edição aberta em painel lateral sobre a página de histórico, sem navegar para "Nova surebet".
- Marcação da operação como geradora de crédito, incluindo o valor esperado.
- Marcação independente de cada perna como uso de crédito de aposta.
- Seleção da surebet que originou o crédito consumido pela perna.
- Resumo de investimento, retorno, lucro e ROI.
- Balanceamento automático das stakes a partir da primeira linha e das odds efetivas.
- Resultado individual de cada cenário exibido em verde para lucro e vermelho para prejuízo.
- Alterações manuais em stakes calculadas desativam o rebalanceamento daquela linha e atualizam somente os resultados.
- Validação obrigatória antes de salvar, com toastr para evento, casas, stakes, odds e campos condicionais de crédito.
- Crédito de aposta usa retorno sem devolução da stake: `stake × profitFactor`; o valor promocional não entra no capital real investido nem no denominador do ROI.
- Liquidação na edição: todas as pernas devem ser marcadas como `WON` ou `LOST`; a finalização calcula o resultado realizado e muda a operação para `SETTLED`.
- Operações geradoras perguntam na liquidação se o crédito foi concedido. Quando positivo, usam `WAITING_CREDIT_USE`; somente depois da liquidação da operação consumidora ambas passam a `SETTLED`.
- A operação consumidora exibe `combinedPromotionProfit`, que soma seu resultado à qualificação que originou o crédito.
- Ao salvar, stakes em dinheiro são debitadas das casas; edições reconciliam a reserva anterior; na liquidação, payouts vencedores são creditados. Stakes promocionais não debitam dinheiro real.
- O frontend bloqueia uma nova reserva quando o saldo disponível da casa é insuficiente.

Somente operações marcadas como geradoras aparecem como origem de crédito. Quando uma operação consumidora for liquidada, o backend deverá liquidar o vínculo do crédito e concluir também o ciclo promocional da operação geradora.

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
