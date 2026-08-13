# Memória de tradução

## Visão geral

A **Memória de tradução** (TM) é um armazenamento de traduções conhecidas
que abrange todo o espaço de trabalho. Quando o texto de origem de uma string
corresponde a um já presente na memória, a tradução armazenada é reutilizada
automaticamente em vez de chamar um módulo pago — economizando tempo e custo
e mantendo o texto idêntico consistente entre projetos. Abra a visualização
**Memória de tradução** pela barra lateral para navegar e pesquisar os
segmentos armazenados.

> **A Memória de tradução vem desativada por padrão** em todo projeto.
> Enquanto estiver desativada, nada que um projeto traduzir é gravado na
> memória, e nenhuma tradução armazenada é aplicada automaticamente. Para
> ativá-la, abra a aba **Configuração** do projeto e escolha uma política de
> reutilização na seção **Memória de tradução** (qualquer valor diferente de
> *Desativada*).

## Como as entradas entram na memória

- **Aprovar para a memória** — na aba **Traduções**, selecione traduções e
  aprove-as; elas são registradas como segmentos confiáveis.
- Traduções concluídas também são registradas, para que o mesmo texto de
  origem possa reutilizá-las depois.

## Política de reutilização

A política de reutilização (na aba **Configuração** do projeto, seção
**Memória de tradução**) controla *se* e *quando* uma tradução armazenada é
reutilizada para um texto de origem idêntico. Por padrão é **Desativada**
(TM desligada); outras opções — por exemplo, **Estrita (correspondência
total de contexto)**, que só reutiliza quando o contexto ao redor também
corresponde — a ativam. Restringir a política evita reutilizar uma tradução
que estava correta em um lugar, mas não em outro.

## Controlando a reutilização por execução

Quando você inicia uma tradução pelo diálogo *Traduzir…* da aba
**Comparação**, um aviso informa quantas entradas seriam preenchidas pela
memória, e você pode **desativar a memória nesta execução** para forçar toda
entrada a ser traduzida do zero — útil quando você quer que o modelo
reconsidere um texto já memorizado anteriormente.
