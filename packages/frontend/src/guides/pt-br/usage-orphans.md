# Aba Órfãos

## Visão geral

A aba **Órfãos** lista entradas que não estão mais presentes no CSV importado
mais recentemente. Elas costumam aparecer depois de uma reimportação em que
uma linha foi removida, renomeada, ou teve seu texto de origem alterado — as
traduções antigas ficam guardadas aqui para você não perder o trabalho.

## O que você pode fazer

- **Excluir** um órfão para remover permanentemente o registro e suas
  traduções (isso não pode ser desfeito).
- **Revincular** um órfão para mover suas traduções para outra entrada.
  Pesquise o destino pelo texto de origem; as traduções já existentes no
  destino são mantidas, e só os idiomas vazios dele são preenchidos.
- Selecione vários órfãos e **Excluir selecionadas** em massa, ou
  **Atualizar** a lista.

## Fluxo de trabalho

1. Reimporte seu CSV de origem pela aba **Dados**.
2. Abra **Órfãos** e revise o que caiu fora.
3. **Revincule** qualquer entrada cujo id ou texto de origem mudou, mas cujas
   traduções ainda são válidas.
4. **Exclua** as entradas que realmente sumiram.

Quando a lista está vazia, toda entrada importada corresponde ao projeto
atual — nada está órfão.
