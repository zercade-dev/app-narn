# Configuração rápida

## Visão geral

O caminho completo para um novo projeto: ative provedores, importe suas
entradas, configure glossários e roteamento, traduza e revise. Passos
marcados como *(Optional)* melhoram a qualidade, mas não são obrigatórios
para uma primeira tradução — pule-os numa primeira passagem e volte depois.

## 1. Ative os provedores e armazene as credenciais

1. Abra a **Configuração global** e **ative um módulo** para cada provedor
   que você quiser (Anthropic, OpenAI, DeepL, e assim por diante). Um módulo
   pode ter várias **instâncias nomeadas** — útil para duas configurações do
   mesmo provedor com chaves ou padrões diferentes.
2. As credenciais dos provedores são armazenadas no **cofre de credenciais**
   criptografado — configure-o no primeiro uso e desbloqueie-o uma vez por
   sessão. Veja o guia *Cofre de credenciais* para saber como funciona.
3. Escolha um **modelo** (e, opcionalmente, um **esforço de raciocínio**) por
   módulo ou instância. Modelos mais baratos traduzem pior, então espere
   alguma tentativa e erro até achar o seu ponto ideal. Fique de olho no
   **esforço de raciocínio** — em modelos de raciocínio (thinking models) ele
   pode multiplicar a cobrança rapidamente.

## 2. Crie o projeto e importe as entradas

Crie um projeto, defina seu **idioma de origem**, depois use **Importação de
CSV** na aba **Dados** para carregar suas entradas de origem (e quaisquer
traduções que o arquivo já tenha).

## 3. *(Optional)* Revise seu texto de origem primeiro

Execute a **Revisão da origem por IA** sobre o idioma de origem antes de
traduzir — corrigir erros de digitação e frases pouco claras aqui beneficia
toda tradução feita depois. Se uma correção alterar uma entrada que já tinha
traduções, as traduções antigas caem na aba **Órfãos** — **revincule-as**,
com retradução opcional.

## 4. *(Optional)* Ative glossários

Na aba **Glossário**, ative os glossários que se aplicam ao seu projeto. A
aplicação automática combina termos como **palavras inteiras, sem diferenciar
maiúsculas de minúsculas** — formas flexionadas (plurais, conjugações) não
são reconhecidas. Traduzindo com o **DeepL**? Envie os glossários para ele
com **Enviar para o DeepL** (canto superior direito), e envie de novo depois
de editar.

## 5. Configure o roteamento

Abra a aba **Roteamento** e escolha seu provedor no seletor com que ela
abre — isso envia toda entrada do projeto para ele, o que é tudo o que uma
configuração de provedor único precisa. Quer provedores diferentes por
idioma, categoria ou comprimento de entrada? Mude para **Avançado** e
adicione **regras de roteamento** lá. Sua escolha é salva de qualquer forma.
Este passo é obrigatório: uma entrada sem regra correspondente falha na
tradução com um erro de *“sem rota”*.

## 6. *(Optional)* Construa glossários a partir do seu próprio conteúdo

Faça seus glossários crescerem antes de uma tradução em massa: adicione
termos manualmente, execute **Gerar glossários** sobre toda a origem, ou —
de forma mais direcionada — selecione boas entradas candidatas em
**Traduções** e use **Gerar glossário a partir da seleção** (inclua as
traduções existentes). Use um modelo capaz aqui; a qualidade do glossário se
acumula em tudo que for traduzido depois.

## 7. *(Optional)* Refine a qualidade primeiro na Comparação

Antes de uma execução de tradução completa, use a aba **Comparação** para
ajustar um idioma que você mesmo consegue avaliar:

- Refine o **contexto** de cada entrada (personagem, tom, notas) e os
  glossários até a tradução soar certa. O contexto é armazenado por entrada,
  não por idioma, então o trabalho se estende automaticamente a todos os
  outros idiomas.
- Como você está iterando entrada por entrada, um modelo barato ou gratuito
  serve bem aqui — por exemplo, uma chave gratuita do Gemini (veja o guia
  *Google AI (Gemini)*), adicionada como sua própria **instância de módulo**,
  com o roteamento apontado para ela temporariamente. O nível gratuito tem um
  limite diário, então prefira requisições agrupadas.
- Satisfeito com os resultados? Traduza o lote completo uma vez com as mesmas
  configurações para confirmar que ele se sustenta em massa.

## 8. Traduza

Duas formas de rodar a tradução de verdade:

- **Traduções** — selecione entradas e **Traduzir as selecionadas** para
  cobrir todos os idiomas de destino de uma vez.
- **Comparação** — um idioma por vez, opcionalmente com um idioma já revisado
  como contexto de **referência**.

Para um projeto completo, um idioma por vez com um idioma de referência já
revisado costuma vencer: a revisão por IA depois fica focada em um único
idioma. Acompanhe o progresso na aba **Atividade**.

O agrupamento em lote é automático por padrão; para um projeto pequeno com
muitas entradas curtas, um tamanho de lote personalizado de **0** (o idioma
inteiro em uma única requisição) pode funcionar melhor com um modelo capaz.

## 9. Revise a execução

Escolha uma opção:

- Dispare uma **revisão por IA** para a execução concluída pela aba
  **Atividade**.
- Revise manualmente em **Revisão manual** ou **Comparação**.
- Aprove tudo como está e revise depois.
