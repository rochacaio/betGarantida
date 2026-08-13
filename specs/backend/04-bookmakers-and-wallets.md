# 04 — Casas e carteiras

## Casos de uso

- Cadastrar conta de casa com nome, apelido opcional e saldo inicial.
- Listar e editar metadados da conta.
- Registrar depósito, saque e ajuste explícito.
- Consultar extrato paginado.
- Exibir saldo disponível, valor em apostas abertas e patrimônio por casa.

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
- Uma operação com várias pernas na mesma casa soma todas as stakes em dinheiro antes da validação.

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
- O backend rejeita concorrência que use o mesmo saldo simultaneamente além do disponível.

