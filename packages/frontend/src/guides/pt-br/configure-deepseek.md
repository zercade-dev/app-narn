# Módulo DeepSeek

## Visão geral

O módulo **DeepSeek** traduz com a API da DeepSeek. Ele precisa de uma chave
de API da DeepSeek, armazenada no cofre de credenciais sob a chave
`DEEPSEEK_API_KEY`.

## Adicione sua chave ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **DeepSeek**. Quando falta uma chave
   necessária, o editor do cofre abre direto na chave correspondente — caso
   contrário, clique em **Gerenciar o cofre de credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `DEEPSEEK_API_KEY`, cole sua chave como valor, digite a sua **senha do
   cofre** e clique em **Salvar**.

Se um cartão mais tarde mostrar *Cofre bloqueado*, clique em **Desbloquear
cofre** antes de traduzir.

## Escolha um modelo

Na aba **Configuração** de um projeto, escolha um modelo DeepSeek (e,
opcionalmente, um esforço de raciocínio), ou deixe que ele herde o padrão
global. As **regras de roteamento** na aba Roteamento decidem qual módulo
trata cada idioma.

## Obtenha uma chave de API da DeepSeek

1. Acesse [platform.deepseek.com](https://platform.deepseek.com).
2. Cadastre-se ou faça login.
3. Abra a sua seção **API keys**.
4. Crie uma nova chave de API e copie-a.
5. Cole-a no valor de `DEEPSEEK_API_KEY` no editor do cofre.
