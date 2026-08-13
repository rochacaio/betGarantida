# 07 — Liquidação e crédito de aposta

## Liquidação normal

`POST /operations/:id/settle` recebe `version`, resultado de todas as pernas e, quando aplicável, a decisão sobre geração do crédito.

Regras da primeira versão:

- operação deve estar `OPEN`;
- todas as pernas recebem `WON` ou `LOST`;
- pelo menos uma perna deve ser `WON`;
- payout é calculado pelo servidor;
- retornos vencedores são creditados uma única vez.

## Operação geradora

Ao criar com `generatesBetCredit=true`, existe um crédito `EXPECTED`.

Na liquidação:

- `creditGenerated=false`: crédito vira `NOT_GRANTED` e operação vira `SETTLED`;
- `creditGenerated=true`: `grantedAmount` é obrigatório, crédito vira `AVAILABLE` e operação vira `WAITING_CREDIT_USE`.

O valor concedido pode diferir do esperado e o valor real prevalece.

## Operação consumidora

Uma perna com `usesBetCredit=true` referencia `betCreditId`, não apenas a operação de origem. Só créditos `AVAILABLE` do usuário aparecem no seletor.

Ao criar a consumidora, o crédito fica reservado para ela dentro da mesma transação. Para simplificar a primeira versão, um crédito é consumido integralmente por uma única operação; uso parcial fica fora do escopo.

Ao liquidar a consumidora:

1. calcular e creditar seus retornos;
2. marcar o crédito `CONSUMED`;
3. marcar a geradora `SETTLED` e preencher `settledAt`;
4. marcar a consumidora `SETTLED`;
5. confirmar tudo atomicamente.

## Resultado promocional combinado

```text
combinedPromotionProfit = qualificationRealizedProfit + consumerRealizedProfit
```

O campo é retornado como visão nas duas operações relacionadas. Não gera transação adicional e não deve ser somado novamente no dashboard.

## Casos de borda

- Cancelar uma consumidora aberta libera o crédito novamente.
- Uma geradora aguardando crédito não pode ser cancelada nem editada financeiramente.
- Falha ao concluir qualquer participante reverte liquidação e lançamentos inteiros.
- Repetir a liquidação com a mesma chave retorna o resultado anterior.
- Chave diferente em operação já liquidada retorna conflito.

