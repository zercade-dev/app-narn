# NARN Freeway

## Visão geral

**NARN Freeway** é um conjunto compartilhado de modelos de IA de plano gratuito para o qual o aplicativo encaminha trabalho automaticamente — sem precisar de cartão de crédito. As chaves de provedor continuam sendo suas; o que o Freeway acrescenta é a contabilidade. Ele acompanha quanta cota gratuita resta em cada provedor, escolhe um modelo para cada lote e passa para outro quando um modelo está com limite de taxa ou esgotado no dia.

Aponte o roteamento para o Freeway e você nunca mais escolhe modelo: o trabalho do Freeway não tem ajuste de modelo nem de esforço de raciocínio, porque a escolha é feita a cada lote, para cada idioma, entre o que o conjunto conseguir atender naquele momento.

## Como ligar

Um projeto recém-criado, ainda sem regras de roteamento, oferece o botão **Deixar o NARN Freeway cuidar de tudo** na aba [Roteamento](guide:usage-routing) — um clique cria uma regra abrangente apontando para o conjunto gratuito.

Fora isso, escolha **NARN Freeway** como qualquer outro provedor: no seletor simples da aba Roteamento, para mandar o projeto inteiro, ou como módulo de uma regra específica em **Avançado**, para usá-lo em alguns idiomas e um provedor pago em outros.

Duas coisas precisam estar prontas antes: ao menos um provedor gratuito com chave guardada no [cofre de credenciais](guide:usage-vault), e o cofre desbloqueado — enquanto ele estiver trancado, todo provedor do Freeway aparece como se não tivesse chave.

## Quais provedores ele usa

O Freeway se apoia nos planos gratuitos dos provedores que você já configurou como módulos. Hoje ele sabe usar:

* **Google AI (Gemini)** — a maior franquia gratuita, e a origem da maioria dos modelos mais fortes do conjunto.
* **Groq** — rápido, com uma contagem diária de requisições generosa.
* **OpenRouter** — os modelos gratuitos que ele hospeda.
* **DeepL** — a franquia mensal de caracteres do plano gratuito, para tradução automática clássica.

<!-- local-only -->

* **GitHub Copilot** — se você tiver uma assinatura do Copilot.

<!-- /local-only -->

Um provedor sem chave é simplesmente ignorado. Cada chave a mais amplia o conjunto e reduz a chance de uma execução ter que esperar.

## Acompanhando o conjunto

O painel **NARN Freeway** na tela de configuração mostra o conjunto inteiro de relance: o status da chave de cada provedor e, por modelo, seu **Estado**, a cota **Restante**, o **Próximo reset** e a **Taxa de aprovação** recente por idioma.

Cada provedor também tem um menu suspenso ao lado que controla como o Freeway o usa: **Automático** deixa o conjunto escolher como de costume, uma instância nomeada fixa o Freeway naquela conta específica, e **Desativado** tira o provedor do conjunto por completo — sem desligar o módulo em nenhum outro lugar. Voltar um provedor desativado para Automático (ou para uma instância nomeada) retoma exatamente de onde parou.

O estado de um modelo é um destes:

* **Pronto** — utilizável agora.
* **Resfriando** — com limite de taxa por um instante; volta sozinho.
* **Esgotado por hoje** — a franquia diária acabou, e o painel mostra quando ela se renova.
* **Módulo desativado** — a chave está guardada, mas o módulo está desligado. O painel oferece ligá-lo.
* **Desativado para o Freeway** — você desativou este provedor para o conjunto pelo seu menu suspenso; o resto do módulo continua igual.
* **Sem chave** — ainda não há nada no cofre para este provedor.
* **Credenciais inválidas** — a chave foi rejeitada. Grave uma chave que funcione no cofre para limpar a marca.

## Quando a cota gratuita acaba

Uma execução que esgota o conjunto não falha. Ela passa para **Aguardando cota gratuita**, guarda os pares que faltam e continua sozinha assim que a franquia de algum provedor se renova — dá para deixar e voltar depois.

Se preferir não esperar, abra a execução na aba [Atividade](guide:usage-activity) e use **Retomar agora com…** para terminar os pares restantes com um provedor pago, ou **Repetir pool gratuito** para tentar o conjunto de novo na hora.

## Níveis de qualidade, e melhorar só o que precisa

Modelos gratuitos não são todos iguais, então cada um carrega um **nível de qualidade** de 1 a 4, sendo 4 o mais forte. Toda tradução registra o nível do modelo que a produziu, o que transforma o “traduzir tudo de graça” numa primeira passada aproveitável:

1. Traduza o projeto inteiro pelo Freeway, sem custo.
2. Na aba **Traduções**, filtre por **Abaixo do nível** para ver o que um modelo mais fraco resolveu.
3. Selecione essas entradas e use **Retraduzir abaixo do nível** para refazer só elas com um provedor melhor.

No fim você paga apenas pelas entradas que realmente precisavam.

## Onde mais o Freeway funciona

O Freeway não é só para tradução. Ele também está disponível como módulo para **revisão por IA**, **revisão de origem** e geração de **glossários** e **categorias** — em cada caso ele escolhe o melhor modelo gratuito para a tarefa e esconde os ajustes de modelo e esforço de raciocínio, já que não há o que escolher. Veja [Revisão por IA](guide:usage-ai-review), [Glossário](guide:usage-glossary) e [Categoria](guide:usage-category).
