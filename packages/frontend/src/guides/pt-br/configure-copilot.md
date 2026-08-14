# Módulo GitHub Copilot

## Visão geral

O módulo **Copilot** traduz através do GitHub Copilot. Ele se autentica com um
token do GitHub de uma conta com **assinatura ativa do Copilot**, armazenado
no cofre de credenciais sob a chave `GITHUB_TOKEN`.

## Adicione seu token ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **GitHub Copilot**. Quando falta uma
   chave necessária, o editor do cofre abre direto na chave correspondente —
   caso contrário, clique em **Gerenciar o cofre de credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `GITHUB_TOKEN`, cole seu token como valor, digite a sua **senha do cofre**
   e clique em **Salvar**.

Se a lista de modelos mostrar *Nenhum modelo disponível*, o token está
ausente, é inválido, ou o cofre está bloqueado — desbloqueie o cofre ou
verifique seu token do GitHub e reabra o cartão.

## Obtenha um token do GitHub

Use um token de acesso pessoal **de granularidade fina** (fine-grained), para
que ele conceda acesso apenas ao Copilot e nada mais.

1. Acesse [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Clique em **Generate new token** (os tokens de granularidade fina são o
   padrão).
3. Dê um nome a ele (por exemplo, “Translator-Copilot”) e defina uma
   **Expiration** (expiração).
4. Em **Permissions → Account permissions**, encontre **Copilot Requests** e
   defina como **Read-only**. Nenhuma outra permissão é necessária.
5. Clique em **Generate token** e copie-o imediatamente — o GitHub o mostra
   apenas uma vez.
6. Cole-o no valor de `GITHUB_TOKEN` no editor do cofre.

A conta por trás do token precisa ter uma assinatura ativa do Copilot para que
as traduções funcionem.
