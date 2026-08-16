# 07 — Liquidação e crédito de aposta

## Liquidação normal

`POST /operations/:id/settle` recebe `version`, resultado de todas as pernas e, quando aplicável, a decisão sobre geração do crédito.

Regras da primeira versão:

- operação deve estar `OPEN`;
- todas as pernas recebem `WON` ou `LOST`;
- pelo menos uma perna deve ser `WON`;
- payout é calculado pelo servidor; uma linha Lay vencedora devolve a
  responsabilidade e credita o ganho líquido de comissão;
- retornos vencedores são creditados uma única vez.

## Operação geradora

Ao criar com `generatesBetCredit=true`, existe um crédito `EXPECTED`.

O crédito pode ser concedido antes da liquidação das linhas por
`POST /operations/:id/generated-credit/grant`. A operação deve continuar
`OPEN`, o crédito passa de `EXPECTED` para `AVAILABLE` e já pode ser reservado
por outra surebet. Essa ação não calcula retorno, não altera resultados das
linhas e não inclui a operação no dashboard.

Na liquidação:

- `creditGenerated=false`: crédito vira `NOT_GRANTED` e operação vira `SETTLED`;
- `creditGenerated=true`: `grantedAmount` é obrigatório, crédito vira `AVAILABLE` e operação vira `WAITING_CREDIT_USE`.

Quando o crédito já tiver sido concedido antecipadamente, a liquidação não
solicita uma nova decisão nem cria outro crédito. Se ele ainda estiver
`AVAILABLE`, a geradora passa para `WAITING_CREDIT_USE`; se já estiver
`CONSUMED`, a geradora passa diretamente para `SETTLED`.

O valor concedido pode diferir do esperado e o valor real prevalece.

Enquanto a operação estiver em `WAITING_CREDIT_USE`, o valor concedido pode
ser corrigido por `PATCH /operations/:id/generated-credit`. A correção exige a
versão atual, valor positivo e crédito ainda `AVAILABLE`, sem reserva por uma
consumidora. Ela atualiza os valores esperado/concedido, incrementa a versão e
gera auditoria; após reserva ou consumo, retorna conflito sem alterar dados.

## Operação consumidora

Uma perna com `usesBetCredit=true` referencia `betCreditId`, não apenas a operação de origem. Só créditos `AVAILABLE` do usuário aparecem no seletor.

Como alternativa, `usesFreeBetCredit=true` representa um crédito promocional
recebido diretamente da casa. Nesse caso `usesBetCredit` também é verdadeiro,
`betCreditId` deve ser nulo, o valor é informado manualmente e nenhuma outra
operação é reservada, consumida ou encerrada.

Ao criar a consumidora, o crédito fica reservado para ela dentro da mesma transação. Para simplificar a primeira versão, um crédito é consumido integralmente por uma única operação; uso parcial fica fora do escopo.

Salvar novamente a própria operação consumidora mantém a reserva existente;
uma reserva da mesma operação é idempotente e não torna o crédito
indisponível para ela. Outra operação continua impedida de usar o crédito.

Ao liquidar a consumidora:

1. calcular e creditar seus retornos;
2. marcar o crédito `CONSUMED`;
3. marcar a geradora `SETTLED` e preencher `settledAt`;
4. marcar a consumidora `SETTLED`;
5. confirmar tudo atomicamente.

Se a consumidora for liquidada enquanto a geradora ainda está `OPEN`, o crédito
é consumido, mas a geradora permanece aberta. Ela será encerrada somente após a
liquidação de todas as suas linhas.

## Resultado promocional combinado

```text
combinedPromotionProfit = qualificationRealizedProfit + consumerRealizedProfit
```

O campo é retornado como visão apenas na operação consumidora. A operação geradora e a consumidora preservam seus resultados individuais; o combinado é somente uma informação complementar. Ele não gera transação adicional e nunca é somado no dashboard.

## Casos de borda

- Cancelar uma consumidora aberta libera o crédito novamente.
- Uma geradora aguardando crédito não pode ser cancelada nem ter apostas já
  liquidadas alteradas; apenas o valor do crédito ainda livre pode ser corrigido.
- Falha ao concluir qualquer participante reverte liquidação e lançamentos inteiros.
- Repetir a liquidação com a mesma chave retorna o resultado anterior.
- Chave diferente em operação já liquidada retorna conflito.
- Um crédito `AVAILABLE` ainda não reservado pode ser marcado como perdido. Ele passa a `EXPIRED`, e a geradora passa de `WAITING_CREDIT_USE` para `SETTLED` sem novos lançamentos financeiros.
