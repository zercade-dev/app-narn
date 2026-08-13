# Módulo Generic AI

## Visão geral

O módulo **Generic AI** se conecta a qualquer API compatível com a OpenAI — um
provedor hospedado ou um servidor rodando localmente (por exemplo, Ollama, LM
Studio, vLLM). Sua chave é armazenada no cofre de credenciais sob
`GENERIC_API_KEY`.

**A chave de API é opcional.** Ela só importa para endpoints que exigem
autenticação (a maioria dos provedores pagos na nuvem). Um servidor local
como o Ollama ou o LM Studio não precisa de uma chave real — mas o cofre
ainda exige que o campo `GENERIC_API_KEY` não fique vazio, então guarde
qualquer valor de preenchimento (por exemplo, `local`) para satisfazê-lo.

## Adicione sua chave ao cofre de credenciais

As credenciais dos provedores vivem em um **cofre de credenciais** criptografado,
não em configuração em texto simples. Você desbloqueia o cofre uma vez por
sessão com uma senha.

1. Abra a **Configuração global** na barra lateral.
2. Se você ainda não configurou o cofre, crie-o: escolha uma senha do cofre
   (você vai reutilizá-la a cada sessão) e desbloqueie-o.
3. Em **Ativar um módulo**, selecione **Generic AI**. Quando falta uma chave
   necessária, o editor do cofre abre direto na chave correspondente — caso
   contrário, clique em **Gerenciar o cofre de credenciais**.
4. No editor do cofre, adicione uma credencial: escolha a chave
   `GENERIC_API_KEY`, digite a sua **senha do cofre** e clique em **Salvar**.
   Para um endpoint pago, cole a chave de API real como valor. Para um
   servidor local que não exige autenticação, a chave é opcional — basta
   guardar qualquer valor de preenchimento não vazio (por exemplo, `local`).

## Rode mais de um endpoint com instâncias

O Generic AI é compatível com **instâncias nomeadas**, para você registrar
vários endpoints lado a lado (por exemplo, um provedor na nuvem e um servidor
local). Use **Adicionar outra instância de Generic AI…** na Configuração
global. Cada instância recebe sua própria chave de cofre derivada — por
exemplo, `GENERIC_API_KEY__MY-OLLAMA` — que você preenche no mesmo editor do
cofre.

## Escolha o endpoint e o modelo

Defina a URL base e o modelo do módulo (ou de cada instância) em suas
configurações na Configuração global, depois escolha o modelo por projeto na
aba **Configuração**. As **regras de roteamento** na aba Roteamento decidem
qual módulo ou instância trata cada idioma.

## Obtenha as credenciais

Para um **servidor local** (Ollama, LM Studio, vLLM), nenhuma conta ou chave
é necessária — apenas a URL base (por exemplo, `http://localhost:11434/v1`) e
um valor de preenchimento no campo `GENERIC_API_KEY`.

Para um **provedor pago**, os passos dependem do provedor: crie uma conta,
obtenha a URL base da API e a chave, e confirme que o endpoint fala o formato
de chat-completions da OpenAI antes de inserir a chave no cofre.
