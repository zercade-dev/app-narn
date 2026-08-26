# Perguntas e respostas

## Visão geral

Respostas curtas para as dúvidas que mais aparecem, cada uma apontando para o guia que trata o assunto a fundo. Esta lista cresce conforme novas perguntas chegam; se a sua ainda não está aqui, a lista de tópicos à esquerda entra em muito mais detalhe.

## O que é traduzido

### Quais entradas uma execução traduz, e quais ela pula?

Só as que ainda precisam. Para cada entrada e cada idioma de destino selecionado, a execução traduz aquele par quando ele ainda não tem tradução — ou quando você pediu explicitamente para **retraduzir**. Um par que já tem texto fica intacto, então repetir uma tradução nunca sobrescreve o trabalho que você já fez ou revisou.

Uma entrada, ou um par específico de entrada e idioma, fica de fora quando qualquer uma destas condições é verdadeira:

* **Já está traduzida**, e você não pediu para retraduzir.
* **Você a marcou como Ignorada.** Isso a tira de *todas* as operações de IA — tradução, revisão por IA, revisão de origem e geração de glossários ou categorias. Entradas ignoradas continuam visíveis na tabela com um selo, então a decisão está sempre à vista e sempre pode ser desfeita.
* **Está órfã** — sumiu da sua última importação de CSV e aguarda na aba [Órfãos](guide:usage-orphans).
* **Foi importada com `Precisa de tradução? = FALSE`.** Veja abaixo.
* **O destino é o idioma de origem.** Uma entrada nunca é traduzida para o próprio idioma de origem, mesmo que você selecione esse idioma como destino.
* **Não há nada para traduzir.** Texto vazio, um número como `3.14` ou `100%`, uma URL solta, uma cor hexadecimal como `#ff8800`, ou um texto que é só tags e marcadores como `<b>{count}</b>` são copiados sem alteração, sem chamar nenhum provedor.

Uma entrada preenchida pela [Memória de tradução](guide:usage-translation-memory) também nunca chega a um provedor — a tradução armazenada é reaproveitada. Ainda assim ela conta como traduzida.

### Posso retraduzir algo que já está traduzido?

Pode, mas precisa pedir, já que as execuções pulam pares concluídos por padrão. Marque **retraduzir** no diálogo *Traduzir…* para um lote, ou use **Retraduzir** numa linha específica na aba [Comparação](guide:usage-compare) ou na fila de revisão manual.

### Por que uma entrada voltou com o texto de origem inalterado?

Quase sempre porque não havia nada para traduzir — o último item da lista acima. Números, URLs, cores e marcação pura são reconhecidos e copiados como estão, porque um modelo só consegue repeti-los ou estragá-los. Nada foi enviado a um provedor e nada foi cobrado por essas entradas.

### O que é a coluna “Precisa de tradução?” no meu CSV, e como ela difere de Ignorada?

**Precisa de tradução?** é uma coluna opcional de importação. Uma linha cujo valor é `FALSE` continua sendo importada e mantida, mas é tratada como não traduzível: ela é filtrada por completo da aba **Traduções** e nunca entra numa execução. Use-a para linhas que precisam sobreviver intactas a uma ida e volta em CSV. Ela só é definida na importação — não existe nenhum interruptor para ela no aplicativo — então, para mudá-la, edite a coluna e importe de novo.

**Ignorada** é o equivalente dentro do aplicativo, e se comporta de forma diferente em um ponto que importa: uma entrada ignorada continua visível na tabela com um selo, então você a vê e pode mudar de ideia. Use *Precisa de tradução?* para linhas que o aplicativo nunca deveria mostrar, e **Ignorar entrada** para aquelas que você quer manter de olho.

## Provedores, modelos e roteamento

### Como mudo o modelo usado nas traduções?

São três níveis, e o que você quer depende de quão amplamente a mudança deve valer:

1. **Para um provedor em todo lugar** — abra a **Configuração global**, encontre o módulo e escolha ali o **modelo**. Todo projeto definido como *Herdar da configuração global* segue isso.
2. **Para um projeto** — abra a aba [Configuração](guide:usage-config) desse projeto e defina o **modelo** (e o **esforço de raciocínio**) do módulo, em vez de herdar.
3. **Só para algumas entradas** — abra a aba [Roteamento](guide:usage-routing), mude para **Avançado** e defina um **modelo personalizado** numa regra de roteamento. Só as entradas que casam com essa regra o usam.

A visão simples da aba Roteamento escolhe um **provedor**, não um modelo: ela roda deliberadamente o modelo com que aquele módulo já está configurado.

### Idiomas diferentes podem usar provedores diferentes?

Podem. Mude a aba [Roteamento](guide:usage-routing) para **Avançado** e adicione uma regra por idioma — ou por categoria, ou por tamanho da entrada. As regras são avaliadas por ordem de prioridade e a primeira que casa com uma entrada vence. Se preferir não escolher nada, aponte uma única regra para o [NARN Freeway](guide:usage-freeway) e deixe que ele escolha um modelo gratuito para cada lote.

### A tradução não começa e diz que não há regra de roteamento. E agora?

Uma execução só começa quando todo idioma nela tem para onde ir. Se um idioma de destino não casa com nenhuma regra, a execução é recusada antes de qualquer envio e a mensagem nomeia o idioma. Abra a aba [Roteamento](guide:usage-routing) e adicione uma regra que o cubra — o seletor simples de provedor cobre todos os idiomas de uma vez — e inicie de novo.

## Execuções, falhas e recuperação

### Algumas strings falharam. Preciso rodar tudo de novo?

Não. Use **Repetir com falha** na execução, na aba [Atividade](guide:usage-activity): ela roda de novo apenas os pares de entrada e idioma que deram erro, e deixa intacto tudo que deu certo.

### Por que preciso desbloquear o cofre outra vez?

O [cofre de credenciais](guide:usage-vault) é desbloqueado por sessão, não em definitivo, e também se tranca sozinho depois de um tempo sem atividade. Desbloqueie e siga em frente. Se havia uma execução em andamento quando ele trancou, use depois **Repetir com falha** nessa execução.

### Reimportei meu CSV e algumas traduções sumiram. Elas se perderam?

Não. Quando uma reimportação não contém mais uma entrada, as traduções dela ficam guardadas na aba [Órfãos](guide:usage-orphans) em vez de serem apagadas. **Revincule** um órfão à entrada que o substituiu para mover as traduções; só os idiomas vazios do destino são preenchidos, então nada é sobrescrito. Além disso, um snapshot é tirado automaticamente logo antes de cada importação, então dá para reverter o projeto inteiro pela aba [Backup](guide:usage-backup).
