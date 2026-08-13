# Aba Atividade

## Visão geral

A aba **Atividade** é a central de controle das tarefas em segundo plano.
Toda tarefa de longa duração aparece aqui: execuções de **tradução**,
**revisão por IA** (da tradução e da origem), **geração de glossário** e
**geração de categorias**. As execuções ficam na fila e são serializadas por
projeto, para você enfileirar várias e acompanhar o andamento delas.

## Lendo uma execução

Cada execução mostra seu **tipo**, **status** (Na fila, Em execução, Pausada,
Concluída, Com falha ou Cancelada), o progresso e um **custo** estimado. Os
custos são estimativas relatadas pelo módulo, derivadas do preço de cada
modelo por milhão de tokens, então modelos de raciocínio (thinking models)
podem mostrar totais de tokens grandes em relação aos caracteres. Use
**Abrir detalhes** para ver exatamente o que uma execução traduziu, as
tentativas repetidas e o uso de caracteres/tokens. Você pode copiar o id de
uma execução como referência.

## Gerenciando a fila

- **Pausar** / **Retomar** uma execução, ou **Iniciar agora** para adiantar
  uma execução que está na fila.
- **Mover para cima** / **Mover para baixo** para reordenar a fila.
- **Cancelar** uma execução que está na fila ou em andamento.

## Recuperando e revisando

- Se algumas strings falharam, **Repetir com falha** executa de novo apenas
  essas.
- Em uma execução de tradução concluída, comece uma **revisão por IA**
  diretamente pela execução — escolha o módulo e o modelo (por padrão, os
  mesmos usados na tradução) e depois abra os veredictos na aba **Revisão da
  tradução por IA**.
