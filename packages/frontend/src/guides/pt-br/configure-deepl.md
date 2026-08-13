# Módulo DeepL

## Visão geral

O módulo **DeepL** oferece tradução automática neural profissional. Ao
contrário dos módulos de LLM, é tradução automática clássica, e ele pode
enviar os glossários do projeto ao DeepL para manter a terminologia
consistente. Sua chave é armazenada no cofre de credenciais sob
`DEEPL_API_KEY`.

## Adicione sua chave ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **DeepL**. Quando falta uma chave
   necessária, o editor do cofre abre direto na chave correspondente — caso
   contrário, clique em **Gerenciar o cofre de credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `DEEPL_API_KEY`, cole sua chave de autenticação como valor, digite a sua
   **senha do cofre** e clique em **Salvar**.

O DeepL não é compatível com instâncias nomeadas — existe um único módulo
DeepL.

## Usando glossários

O DeepL pode aplicar um glossário durante a tradução. Crie os termos na aba
**Glossário** e depois use **Enviar para o DeepL** para enviá-los. Se um
glossário mudar depois de um envio, a aba mostra *Novo envio necessário* —
envie de novo para atualizar o DeepL.

## Obtenha uma chave de API do DeepL

1. Acesse [deepl.com/account](https://www.deepl.com/account).
2. Cadastre-se em uma conta de API Free ou Pro.
3. Abra **Account Settings** e encontre a seção **API Key**.
4. Copie sua chave de autenticação.
5. Cole-a no valor de `DEEPL_API_KEY` no editor do cofre.
