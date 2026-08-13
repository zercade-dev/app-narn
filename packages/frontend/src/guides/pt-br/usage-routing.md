# Aba Roteamento

## Visão geral

A aba **Roteamento** decide qual módulo e modelo trata cada entrada. Ela abre
em um seletor de provedor único: escolha um provedor e toda entrada do
projeto vai para ele. Isso é tudo que a maioria dos projetos precisa.

Precisa de mais de um destino? Mude a aba para **Avançado** e o construtor
completo de regras aparece, onde o roteamento pode variar por idioma de
destino, categoria ou comprimento de entrada, e onde você pode manter vários
**grupos de regras** nomeados. A aba lembra qual dos dois modos você usou por
último. Um projeto cujo roteamento é mais rico que um único provedor sempre
mostra o construtor, seja qual for o modo escolhido — uma configuração já
existente nunca fica escondida de você.

De qualquer forma, esta aba só decide *como* as entradas são despachadas. As
traduções são iniciadas pela aba **Traduções** ou **Comparação**.

## Regras de roteamento

As regras vivem na visualização **Avançado**. Elas são avaliadas em ordem de
prioridade; a primeira que corresponder a uma entrada vence. Cada regra pode
combinar com:

- **Origens** — os rótulos de origem/procedência das entradas importadas.
- **Limite de comprimento da entrada** — aplica-se apenas a entradas com uma
  contagem de caracteres igual ou menor.
- **Idioma de destino** e **categorias**.

Para entradas correspondentes, a regra define o **módulo** (e, opcionalmente,
uma substituição de **modelo** e de **esforço de raciocínio**), além de
dicas de prompt opcionais (personagem, tom, gênero, observações). Adicione
regras com **Adicionar regra**; toda alteração é salva automaticamente
conforme você a faz, então não há botão **Salvar** para lembrar. Você pode
manter vários **grupos de regras** nomeados e alternar entre eles (a troca
fica bloqueada enquanto uma execução está em andamento).

## Agrupamento de lote

A aba Roteamento também tem um controle de **Agrupamento de lote** — o mesmo
padrão por projeto mostrado na aba Configuração, com um alternador
correspondente de **Ignorar o limite de tamanho do lote**. Ele mantém
entradas relacionadas na mesma requisição do provedor durante execuções de
tradução, avaliação e revisão da origem.

## Iniciando uma tradução

1. Selecione entradas na aba **Traduções** ou **Comparação**.
2. Abra o diálogo **Traduzir…** a partir de lá — ele oferece opções de
   retradução, memória e agrupamento por execução, e então inicia a
   execução.
3. Acompanhe o progresso, as tentativas repetidas e as falhas na aba
   **Atividade**.
