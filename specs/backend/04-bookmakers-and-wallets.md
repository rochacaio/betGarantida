# 04 — Casas e carteiras

## Casos de uso

- Cadastrar conta de casa com nome, titular, apelido opcional e saldo inicial.
- Listar e editar metadados da conta.
- Registrar depósito, saque e ajuste explícito.
- Consultar extrato paginado.
- Transferir saldo entre duas casas ativas do mesmo usuário.
- Exibir saldo disponível, valor em apostas abertas e patrimônio por casa.
- Manter saldo reservado de trânsito para valores retirados de uma casa que
  continuam destinados a futuras apostas.

## Ledger

O saldo inicial cria `INITIAL_BALANCE`; não é simplesmente gravado no campo de saldo. A alteração do nome da casa não produz lançamento. O saldo não pode ser editado diretamente.

Para cada conta:

```text
availableBalance = soma(wallet_transactions.amount)
openStake = valor em dinheiro reservado em pernas OPEN
equity = availableBalance + openStake
```

O `cachedBalance` pode acelerar leituras, mas é atualizado na mesma transação do lançamento. Deve existir rotina de reconciliação que compare cache e soma do ledger.

## Regras

- Não permitir aposta em dinheiro acima do saldo disponível combinado da conta.
- Stake promocional não debita caixa.
- Casas com histórico não são apagadas; são arquivadas.
- Saque não pode tornar saldo negativo.
- Ajuste exige motivo e gera auditoria.
- Ajuste define o saldo final informado; o ledger registra somente a diferença entre o saldo anterior e o novo. Depósito soma e saque subtrai.
- Uma operação com várias pernas na mesma casa soma todas as stakes em dinheiro antes da validação.
- Contas da mesma casa podem pertencer a titulares diferentes. A seleção das
  pernas e toda movimentação financeira continuam vinculadas ao ID da conta,
  nunca apenas ao nome da casa ou do titular.
- Transferências entre contas de titulares diferentes são permitidas desde que
  ambas pertençam ao mesmo usuário gestor, estejam ativas e atendam às regras
  de saldo.
- Reservar saldo não é saque pessoal: debita a casa e credita o ledger reservado
  na mesma transação. Enviar a reserva a outra casa faz o movimento inverso.
  Ambos os lados aparecem nos respectivos históricos e nenhum saldo pode ficar
  negativo.

## Efeitos das operações

- Criar: `BET_STAKE` negativo por perna em dinheiro.
- Editar OPEN: `BET_REFUND` da reserva anterior e novo `BET_STAKE`, ambos vinculados à revisão; a transação valida o saldo final.
- Cancelar OPEN: `BET_REFUND` por stake anteriormente reservada.
- Liquidar: `BET_RETURN` positivo para cada payout vencedor.
- Consumir crédito: opcionalmente registrar `BONUS_USED` informativo, sem reduzir saldo em dinheiro.

Todos os efeitos possuem chave idempotente determinística por operação, revisão, perna e tipo.

## Critérios de aceite

- Repetir criação, edição ou liquidação não altera o saldo duas vezes.
- Uma falha em qualquer lançamento desfaz toda a operação.
- O extrato explica integralmente o saldo mostrado.
- Uma transferência é atômica: cria `TRANSFER_OUT` na origem e `TRANSFER_IN`
  no destino, ambos vinculados pelo mesmo `transferId`. A origem precisa ter
  saldo suficiente e origem/destino devem ser contas diferentes e ativas.
- O backend rejeita concorrência que use o mesmo saldo simultaneamente além do disponível.
