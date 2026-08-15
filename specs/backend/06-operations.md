# 06 — Operações de surebet

## Criar

`POST /operations` exige evento e pelo menos duas pernas completas. O servidor:

1. autentica e valida propriedade das contas;
2. valida eventual crédito usado;
3. calcula o snapshot;
4. bloqueia contas/créditos relevantes;
5. valida os saldos agregados;
6. cria operação e pernas;
7. debita a stake nas linhas Back e a responsabilidade nas linhas Lay;
8. cria crédito `EXPECTED` quando aplicável;
9. confirma tudo em uma transação.

A operação nasce `OPEN`. O frontend começa com duas linhas vazias, mas isso é comportamento de UI, não dado do backend.

## Preview

`POST /operations/preview` executa validação matemática e retorna stakes/snapshot sem persistir ou movimentar saldo. Serve ao balanceamento autoritativo e não reserva fundos.

O preview é progressivo: não exige evento nem casa e aceita stake ausente nas
linhas automáticas posteriores à âncora. Criar e editar continuam exigindo todas
as pernas completas.

## Editar

`PATCH /operations/:id` aceita dados editáveis e `version`. Apenas `OPEN` pode ser alterada financeiramente. O backend reconcilia os lançamentos antigos e novos atomicamente.

Alterações manuais de stake são aceitas; o backend não deve rebalanceá-las silenciosamente. O cliente informa as stakes finais que deseja salvar, e o servidor recalcula somente os resultados.

A substituição de pernas preserva o histórico financeiro: as stakes antigas são
estornadas com `BET_REFUND`, as novas são debitadas com `BET_STAKE` e referências
de ledger a pernas substituídas tornam-se nulas sem apagar os lançamentos.

## Consultar

- Lista paginada, mais recentes primeiro.
- Filtros por status, período, casa e busca textual no evento.
- Detalhe inclui pernas, snapshot, crédito, resultados e versão.
- O snapshot matemático completo é persistido como JSON junto de `engineVersion`.
- Nunca retornar operações de outro usuário.

## Cancelar

`POST /operations/:id/cancel` só aceita `OPEN`, exige motivo opcional, estorna stakes em dinheiro, cancela crédito esperado e marca `CANCELLED` atomicamente.

## Exclusão e correções

Não há `DELETE` físico para operações com efeitos financeiros. Operações encerradas são imutáveis na primeira versão. Uma correção futura deverá criar revisão e lançamentos compensatórios auditados.

## Validações condicionais

- `generatesBetCredit=true` exige `expectedBetCredit > 0`.
- `usesBetCredit=true` exige crédito disponível e valor compatível.
- A operação não pode usar crédito originado por ela própria.
- A mesma origem não pode ser selecionada por operações concorrentes.
- `betType=LAY` exige dinheiro real, não aceita crédito, cashback ou aumento e
  reserva `stake × (odd - 1)` no saldo da casa.
- Todos os campos obrigatórios geram erros estruturados por caminho, para o toastr e os campos do frontend.
