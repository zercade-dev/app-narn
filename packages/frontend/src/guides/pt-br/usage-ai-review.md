# Revisão por IA

## Visão geral

Além das verificações automáticas de LQA, o app pode usar um modelo de IA
para revisar seu conteúdo. Há duas abas de revisão por IA, além de uma fila
de revisão manual. Toda revisão por IA exige um módulo de LLM ativado na
**Configuração global** e o cofre de credenciais desbloqueado.

## Revisão da tradução por IA

A aba **Revisão da tradução por IA** tem um avaliador de IA que pontua as
traduções concluídas quanto a **precisão, fluência, terminologia e tom**.

- Clique em **Revisar a última execução** para avaliar a execução de tradução
  concluída mais recente (ou comece uma revisão a partir de uma execução
  específica na aba **Atividade**).
- Percorra os resultados sinalizados; cada veredicto mostra a origem, a
  tradução, uma **pontuação** e, muitas vezes, uma **sugestão**.
- **Aplique** uma sugestão para substituir a tradução, ou **Aplicar todas as
  sugestões** para aplicá-las de uma vez. Um aviso aparece se uma sugestão
  fosse eliminar tags, placeholders ou quebras de linha.

## Revisão da origem por IA

A aba **Revisão da origem por IA** verifica **o próprio texto de origem** —
é apenas informativa e nunca altera traduções.

1. Escolha as verificações a executar: **erro de digitação**, **gramática**,
   **terminologia**, **clareza** e conteúdo **impróprio**.
2. Escolha o **módulo** e o **modelo** e, opcionalmente, o **idioma da
   resposta** para as constatações.
3. Clique em **Iniciar revisão**. Ela roda em segundo plano — acompanhe o
   progresso na aba **Atividade**.
4. Revise cada constatação e **Aprove** ou **Ignore** — uma reescrita da
   origem sugerida pode ser copiada.

## Revisão manual

A aba **Revisão manual** é uma fila de revisão humana. Traduções marcadas
como **Precisa de revisão** (ou **Sinalizada**) aparecem aqui, onde você pode
**Aprovar**, **Editar**, **Sinalizar**, **Retraduzir** ou pedir uma
**retrotradução** para a origem como referência. Atalhos de teclado agilizam
o trabalho: `↑`/`↓` para mover, `a` para aprovar, `e` para editar.
