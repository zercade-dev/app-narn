# Módulo OpenRouter

## Visão geral

O módulo **OpenRouter** traduz com o [OpenRouter](https://openrouter.ai) — uma
única API que encaminha para modelos de muitos fornecedores (Anthropic,
OpenAI, Google, Meta e outros). Ele precisa de uma chave de API do
OpenRouter, armazenada no cofre de credenciais sob a chave
`OPENROUTER_API_KEY`.

## Adicione sua chave ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **OpenRouter**. Quando falta uma chave
   necessária, o editor do cofre abre direto na chave correspondente — caso
   contrário, clique em **Gerenciar o cofre de credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `OPENROUTER_API_KEY`, cole sua chave como valor, digite a sua **senha do
   cofre** e clique em **Salvar**.

Se um cartão mais tarde mostrar *Cofre bloqueado*, clique em **Desbloquear
cofre** antes de traduzir.

## Escolha um modelo

Na aba **Configuração** de um projeto, escolha um modelo do catálogo do
OpenRouter em tempo real — cada item mostra seu preço por token e o tamanho
do contexto, e só modelos de geração de texto são listados. Os ids de modelo
têm o prefixo do fornecedor (por exemplo, `anthropic/claude-sonnet-4.5` ou
`openai/gpt-4o-mini`); você também pode digitar um slug novo diretamente. As
**regras de roteamento** na aba Roteamento decidem qual módulo trata cada
idioma.

## Obtenha uma chave de API do OpenRouter

1. Acesse [openrouter.ai](https://openrouter.ai).
2. Cadastre-se ou faça login.
3. Abra **Keys** no menu da sua conta.
4. Crie uma nova chave de API e copie-a.
5. Cole-a no valor de `OPENROUTER_API_KEY` no editor do cofre.

Observação: seu texto é enviado ao OpenRouter e encaminhado ao fornecedor do
modelo que você selecionar, sob os termos do OpenRouter e a política de dados
desse fornecedor.
