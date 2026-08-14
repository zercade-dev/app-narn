# Módulo Google AI (Gemini)

## Visão geral

O módulo **Google AI** traduz com os modelos Gemini do Google. Ele precisa de
uma chave de API do Google AI Studio, armazenada no cofre de credenciais sob
a chave `GOOGLE_API_KEY`.

## Adicione sua chave ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **Google AI (Gemini)**. Quando falta
   uma chave necessária, o editor do cofre abre direto na chave
   correspondente — caso contrário, clique em **Gerenciar o cofre de
   credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `GOOGLE_API_KEY`, cole sua chave como valor, digite a sua **senha do
   cofre** e clique em **Salvar**.

Se um cartão mais tarde mostrar *Cofre bloqueado*, clique em **Desbloquear
cofre** antes de traduzir.

## Escolha um modelo

Na aba **Configuração** de um projeto, escolha um modelo Gemini (e,
opcionalmente, um esforço de raciocínio), ou deixe que ele herde o padrão
global. As **regras de roteamento** na aba Roteamento decidem qual módulo
trata cada idioma. Modelos de raciocínio (thinking models) relatam contagens
de tokens grandes em relação aos caracteres, então as estimativas de custo
podem parecer altas.

## Obtenha uma chave de API do Google

1. Acesse [ai.google.dev](https://ai.google.dev) e clique em **Get API key**,
   ou vá direto para
   [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Clique em **Create API key** e selecione seu projeto.
3. Copie a chave gerada.
4. Cole-a no valor de `GOOGLE_API_KEY` no editor do cofre.
