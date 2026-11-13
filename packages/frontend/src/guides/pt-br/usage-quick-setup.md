# Configuração rápida

## Visão geral

Novo no NARN? O caminho curto abaixo leva você do zero a uma tradução exportada em cinco passos. A configuração guiada no aplicativo conduz você pelos mesmos passos, e você pode pulá-la e retomá-la depois — **Continuar a configuração** na barra lateral continua de onde você parou, e você pode reiniciá-la a partir deste Guia. Tudo o que vem depois do caminho curto é para quando você quiser mais controle.

## O caminho curto

1. **Crie a senha do seu cofre.** Suas chaves de provedor são criptografadas com ela — veja o guia [Cofre de credenciais](guide:usage-vault). Na versão em nuvem, os passos 1 e 2 acontecem juntos na página do cofre.
2. **Adicione uma chave gratuita.** Uma chave do Google AI é o começo mais fácil — obtenha uma em [aistudio.google.com/apikey](https://aistudio.google.com/apikey), ou escolha **Usar meu próprio provedor**. O [NARN Freeway](guide:usage-freeway) então escolhe modelos gratuitos para você.
3. **Crie um projeto e importe seu texto.** Crie um projeto, depois na aba **Dados** escolha o idioma de origem e os idiomas para os quais traduzir, e use **Importação de CSV**.
4. **Traduza.** Em **Traduções**, selecione todas as entradas e clique em **Traduzir**. O NARN Freeway escolhe modelos gratuitos para você; acompanhe o progresso em **Atividade**.
5. **Exporte.** Baixe o arquivo traduzido a partir do projeto.

Novos usuários começam no **modo Simples**, que mostra só Configuração, Dados, Traduções e Atividade (mais Guia, Preferências e **Chaves dos provedores**). Alterne entre **Simples** e **Avançado** pela barra superior ou nas Preferências quando quiser.

## Quando você quiser mais

Estes passos ficam no **modo Avançado** e melhoram a qualidade ou dão um controle mais fino. Os passos marcados *(Optional)* não são necessários para uma primeira tradução — pule-os e volte depois. Na primeira vez que você abrir Roteamento, Glossário, Qualidade, Comparação ou Revisão da tradução por IA no modo Avançado, um tour curto é oferecido; você pode iniciar qualquer tour de novo a partir deste Guia, ou desativar as ofertas nas Preferências.

## Adicione mais provedores e credenciais

1. Abra a **Configuração global** e **ative um módulo** para cada provedor que você quiser (Anthropic, OpenAI, DeepL, e assim por diante) na lista **Ativar um módulo** — o DeepL aparece pelo nome, enquanto os provedores de IA aparecem como **Adicionar outra instância de …**, que cria a primeira instância do provedor. Um módulo pode ter várias **instâncias nomeadas** — útil para duas configurações do mesmo provedor com chaves ou padrões diferentes.
2. As credenciais dos provedores são armazenadas no **cofre de credenciais**
   criptografado — configure-o no primeiro uso e desbloqueie-o uma vez por
   sessão. Veja o guia *Cofre de credenciais* para saber como funciona.
3. Escolha um **modelo** (e, opcionalmente, um **esforço de raciocínio**) por
   módulo ou instância. Modelos mais baratos traduzem pior, então espere
   alguma tentativa e erro até achar o seu ponto ideal. Fique de olho no
   **esforço de raciocínio** — em modelos de raciocínio (thinking models) ele
   pode multiplicar a cobrança rapidamente.

## *(Optional)* Revise seu texto de origem primeiro

Execute a **Revisão da origem por IA** sobre o idioma de origem antes de
traduzir — corrigir erros de digitação e frases pouco claras aqui beneficia
toda tradução feita depois. Se uma correção alterar uma entrada que já tinha
traduções, as traduções antigas caem na aba **Órfãos** — **revincule-as**,
com retradução opcional.

## *(Optional)* Ative glossários

Na aba **Glossário**, ative os glossários que se aplicam ao seu projeto. A
aplicação automática combina termos como **palavras inteiras, sem diferenciar
maiúsculas de minúsculas** — formas flexionadas (plurais, conjugações) não
são reconhecidas. Traduzindo com o **DeepL**? Envie os glossários para ele
com **Enviar para o DeepL** (canto superior direito), e envie de novo depois
de editar.

## Configure o roteamento

Abra a aba **Roteamento** e escolha seu provedor no seletor com que ela abre —
isso envia toda entrada do projeto para ele, o que é tudo o que uma
configuração de provedor único precisa. Quer provedores diferentes por idioma,
categoria ou comprimento de entrada? Mude para **Avançado** e adicione
**regras de roteamento** lá. Sua escolha é salva de qualquer forma. Um projeto
sem nenhuma regra envia tudo pelo NARN Freeway, então este passo é opcional no
começo. Quando o projeto tem regras, uma entrada que não corresponde a nenhuma
falha na tradução com um erro de *“sem rota”*.

## *(Optional)* Construa glossários a partir do seu próprio conteúdo

Faça seus glossários crescerem antes de uma tradução em massa: adicione
termos manualmente, execute **Gerar glossários** sobre toda a origem, ou —
de forma mais direcionada — selecione boas entradas candidatas em
**Traduções** e use **Gerar glossário a partir da seleção** (inclua as
traduções existentes). Use um modelo capaz aqui; a qualidade do glossário se
acumula em tudo que for traduzido depois.

## *(Optional)* Refine a qualidade primeiro na Comparação

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

## Traduza em lote

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

## Revise a execução

Escolha uma opção:

- Dispare uma **revisão por IA** para a execução concluída pela aba
  **Atividade**.
- Revise manualmente em **Revisão manual** ou **Comparação**.
- Aprove tudo como está e revise depois.
