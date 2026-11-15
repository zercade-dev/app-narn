# Aba Glossário

## Visão geral

A aba **Glossário** mantém a terminologia consistente. Um projeto pode ter
vários glossários; cada um é uma lista de termos de origem com uma tradução
por idioma de destino. Os glossários são comparados com as entradas
automaticamente, e os termos correspondentes são passados ao modelo durante a
tradução.

## Glossários e termos

- Crie um glossário com **Novo glossário**; renomeie-o ou exclua-o depois.
- **Ative** ou **desative** um glossário — um glossário desativado é
  ignorado durante a importação e a tradução.
- Adicione termos com uma **origem**, uma **tradução por idioma** e
  **observações** opcionais.
- Marque um termo como **constante** quando ele precisar sair exatamente como está escrito no glossário, como o nome de um personagem ou uma marca — veja *Termos constantes* abaixo.
- Um glossário tem duas abas: **Termos** lista os termos dele, e **Correspondências** lista as entradas que os contêm, onde você pode atribuir o glossário às entradas ou removê-lo.

Alguns glossários são **somente leitura** (gerenciados globalmente) e
contribuem com termos sem serem editáveis aqui.

## Termos constantes

- Um termo constante **nunca é enviado ao mecanismo de tradução**. O NARN o troca por um marcador antes de traduzir e depois coloca a tradução do glossário no lugar, então um nome de personagem como *Diluc* sempre sai exatamente como está escrito no glossário.
- **Maiúsculas e minúsculas importam.** Só é protegido o texto escrito exatamente como o termo: *Razor* (o personagem) é, *a razor* não. Qualquer outra grafia é enviada ao mecanismo como uma dica comum do glossário, marcada como nome, para que ele distinga o nome da palavra comum.
- **O mecanismo não pode mudar a palavra.** Como nunca vê o termo, ele não consegue flexioná-lo nem fazer outras palavras concordarem com ele: em idiomas como russo, coreano ou turco, um nome constante sempre aparece na forma base. Use constante para nomes e códigos que precisam ficar fixos.
- Deixe como termos normais os nomes que também são palavras comuns, pois títulos e rótulos costumam escrevê-los com maiúscula (*Gaming Settings*). No glossário incluído **Genshin Characters**, todos os nomes são constantes, exceto Gaming, Amber, Razor, Sucrose e Prune.

## Importar e exportar

Importe termos de **CSV** ou **TBX** — uma prévia mostra quantos termos são
adicionados, atualizados ou estão em conflito antes de você aplicar.
Exporte o glossário de volta para **CSV** ou **TBX**.

## Gerar com IA

- **Gerar glossários** analisa o texto de origem e propõe glossários de
  nomes e termos personalizados recorrentes. A execução roda em segundo
  plano — acompanhe na aba **Atividade** e revise as sugestões antes de
  criá-los. Você pode passar glossários existentes como “já conhecidos”, para
  que o modelo não os repita.
- **Gerar traduções** preenche as traduções de destino dos termos que ainda
  estão sem elas.

## DeepL

Se você traduz com o DeepL, use **Enviar para o DeepL** para enviar os
termos do glossário. Depois de editar um glossário já enviado, a aba mostra
*Novo envio necessário* — envie de novo para atualizar o DeepL.

## Controle por entrada

Na aba Traduções, você pode escolher quais glossários ficam **ativados**
para uma entrada individual.
