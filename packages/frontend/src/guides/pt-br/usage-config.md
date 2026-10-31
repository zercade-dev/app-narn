# Aba Configuração

## Visão geral

A aba **Configuração** guarda a política de tradução do projeto selecionado:
escolhas de modelo por módulo, reutilização da memória de tradução,
agrupamento de lote, verificações de qualidade (LQA) e gerenciamento do
projeto. Seus **idiomas** e a **importação/exportação de CSV** agora ficam na
aba **Dados**, separada. As credenciais dos provedores não ficam definidas
aqui — elas vivem no **cofre de credenciais** (veja os guias *Configurar
módulo* e a **Configuração global**).

## Idiomas (na aba Dados)

Defina o **idioma de origem** e os **idiomas de destino** para traduzir na
aba **Dados**. O conjunto de destinos ativo orienta todas as outras abas — as
colunas de entrada, as regras de roteamento e as verificações de qualidade
seguem ele.

## Importar e exportar CSV (na aba Dados)

A importação e exportação de CSV também ficam na aba **Dados**:

- **Importação de CSV** carrega as entradas de origem e quaisquer traduções
  já existentes no arquivo. Um instantâneo de segurança é criado
  automaticamente logo antes de cada importação, então você pode reverter
  pela aba **Backup**.
- Linhas que não podem ser interpretadas corretamente (uma aspa imediatamente
  seguida de vírgula) são descartadas e relatadas, em vez de gravadas como
  dados deslocados de coluna.
- **Exportar CSV** baixa o projeto; você pode escolher os idiomas e se deseja
  incluir a coluna de contexto do tradutor.
- As exportações gravam o texto como está salvo, sem adicionar um apóstrofo antes das células que começam com = + - ou @. Em **Exportar para**, **Editor do jogo** é a opção padrão. Escolha **Excel ou Sheets** apenas para arquivos que você vai visualizar em uma planilha: isso adiciona esse apóstrofo, que o editor do Miliastra mantém como texto, e a escolha é redefinida após cada exportação. Um arquivo de script de cliente protegido não deve ser reimportado nem enviado ao editor. As execuções de tradução ignoram as linhas cujo valor de Need translation? é FALSE.

### Arquivos de script de cliente

Um CSV com a coluna **Text Mapping ID** é um arquivo de script de cliente. Ele é importado para uma coleção própria, **Texto de script de cliente**, separada do seu **Texto principal** — a planilha de importação informa qual foi detectada.

* Cada string de cliente é identificada pelo seu Text Mapping ID, então o mesmo inglês pode aparecer nas duas coleções, e em várias linhas de cliente, sem ser mesclado.
* Importar um arquivo de cliente nunca altera o texto principal, e importar um arquivo principal nunca altera o texto de cliente.
* Quando o inglês de uma chave existente muda, em qualquer modo de importação, a linha antiga vai para a aba **Órfãos** e a nova mantém as traduções do arquivo; só as células vazias ficam sem tradução. Use **Revincular** para levar as traduções: a linha com a mesma chave é sugerida primeiro, e o modo de substituição decide se as células preenchidas são mantidas ou substituídas.
* Quando um projeto tem strings de cliente, a **Exportação de CSV** permite escolher qual coleção baixar, e uma exportação de cliente mantém a coluna Text Mapping ID.

## Módulos e modelos

Ative os provedores uma vez na **Configuração global**. Aqui, na
Configuração, você escolhe, por projeto, o **modelo** e o **esforço de
raciocínio** para cada módulo ativado — ou deixa-os definidos como *Herdar da
configuração global*. Qual módulo de fato roda para uma dada entrada é
decidido pelas **regras de roteamento** (veja o guia *Roteamento*).

## Verificações de LQA

O painel **Verificações de LQA** configura o gate de qualidade que roda em
toda tradução: alterne verificações individuais (igualdade de tags, limite
de comprimento, estouro, aderência ao glossário, termos proibidos, asserções
de regex e mais) e defina cada uma como **Bloqueante** ou **Aviso**.
Problemas bloqueantes reprovam o gate e podem disparar uma nova tentativa
automática; avisos são apenas relatados.

## Agrupamento de lote

O **agrupamento de lote** mantém entradas relacionadas (por categoria e/ou
glossário) juntas na mesma requisição, para que o modelo as veja em
contexto. Você pode definir um padrão para o projeto e substituí-lo por
execução.

## Gerenciamento do projeto

A **Zona de perigo** permite **Duplicar** o projeto (configuração e
entradas, nunca segredos) ou **Excluí-lo** permanentemente.
