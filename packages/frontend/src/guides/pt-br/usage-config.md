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
