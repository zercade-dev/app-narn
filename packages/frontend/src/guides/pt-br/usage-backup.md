# Aba Backup

## Visão geral

A aba **Backup** empacota um projeto — sua configuração, entradas e glossário
— em um arquivo `.zip` verificável. Todo arquivo tem uma soma de verificação
(checksum), e as somas de verificação são conferidas antes de qualquer coisa
ser gravada na restauração.

## Criando um backup

1. Selecione um projeto.
2. Abra a aba **Backup**.
3. Clique em **Criar backup**.
4. O novo arquivo aparece em **Backups salvos**, onde você pode **Baixar** o
   arquivo.

## Backups automáticos

O app também tira instantâneos (snapshots) de segurança para você,
listados junto com os backups manuais:

- **Antes de uma importação de CSV** — um ponto de restauração de logo antes
  da importação.
- **Antes de uma retradução** — um ponto de restauração de logo antes de as
  entradas serem sobrescritas.

A Configuração global define o **Máximo de backups por projeto** (padrão 10);
backups mais antigos são removidos além desse limite.

## Restaurando

1. Em **Restauração a partir de backup**, selecione um `.zip` (ou escolha um
   dos backups salvos).
2. O app verifica as somas de verificação e mostra uma prévia (projeto,
   arquivos, hora de criação).
3. Confirme. Restaurar sobrescreve a configuração, as entradas e o glossário
   atuais do projeto — isso não pode ser desfeito, então crie um backup novo
   primeiro se tiver dúvida.

## Excluindo

Use **Excluir** em qualquer backup salvo para remover esse arquivo do
servidor permanentemente.
