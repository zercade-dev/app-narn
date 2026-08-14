# Módulo Groq

## Visão geral

O módulo **Groq** traduz com o [Groq](https://groq.com) — inferência rápida
para modelos abertos como Llama, Qwen e GPT-OSS, com um nível gratuito que
atende bem ao trabalho de tradução do dia a dia. Ele precisa de uma chave de
API do Groq, armazenada no cofre de credenciais sob a chave
`GROQ_API_KEY`.

## Adicione sua chave ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **Groq**. Quando falta uma chave
   necessária, o editor do cofre abre direto na chave correspondente — caso
   contrário, clique em **Gerenciar o cofre de credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `GROQ_API_KEY`, cole sua chave como valor, digite a sua **senha do
   cofre** e clique em **Salvar**.

Se um cartão mais tarde mostrar *Cofre bloqueado*, clique em **Desbloquear
cofre** antes de traduzir.

## Escolha um modelo

Na aba **Configuração** de um projeto, escolha um modelo do catálogo do
Groq em tempo real, ou herde o padrão global. `llama-3.3-70b-versatile` é
uma boa opção padrão para a qualidade da tradução; modelos menores como
`llama-3.1-8b-instant` trocam um pouco de qualidade por velocidade. As
**regras de roteamento** na aba Roteamento decidem qual módulo trata cada
idioma.

## Obtenha uma chave de API do Groq

1. Acesse [console.groq.com](https://console.groq.com).
2. Cadastre-se ou faça login.
3. Abra **API Keys** no menu do console.
4. Crie uma nova chave de API e copie-a — ela começa com `gsk_`.
5. Cole-a no valor de `GROQ_API_KEY` no editor do cofre.

O nível gratuito do Groq aplica limites diários por modelo (sem números
fixos aqui — consulte seu console para ver os limites atuais), e, segundo
os termos do Groq, os dados de API não são usados para treinar modelos.
Depois que sua chave for adicionada, o **NARN Freeway** inclui
automaticamente o plano gratuito do Groq ao distribuir o trabalho de
tradução entre as cotas gratuitas dos seus provedores conectados — sem
configuração extra.
