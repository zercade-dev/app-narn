# Pseudo Test

## Visão geral

O **Pseudo Test** não é um idioma real. É um idioma de QA gratuito e offline
que reescreve seu texto de origem em uma versão deliberadamente distorcida,
para você carregá-la no seu jogo e ver quais strings quebram a interface —
antes mesmo de existir uma única tradução real.

Não custa nada, não precisa de chave de API, e nunca envia nada a um
provedor.

## O que ele produz

`Save changes` vira algo como `⟦Şàvé çhàñgéş~~~~⟧`. Três coisas acontecem ao
mesmo tempo, e cada uma expõe uma classe diferente de bug:

- **Letras acentuadas.** Cada letra é trocada por uma parecida com acento.
  Qualquer texto que ainda apareça como inglês simples no seu jogo nunca foi
  puxado para a tabela de strings — ele está fixo no código (hardcoded), e
  nenhum tradutor jamais vai conseguir alcançá-lo.
- **Preenchimento (padding).** O texto é esticado com caracteres `~` até
  aproximadamente 1,4× o seu comprimento original, simulando idiomas como o
  alemão, que costumam ficar longos. Rótulos que estouram seus botões,
  quebram mal a linha, ou empurram o layout ficam visíveis imediatamente.
- **Colchetes.** O resultado é envolvido em `⟦…⟧`. Se algum dos colchetes
  estiver faltando na tela, essa string está sendo truncada.

Placeholders e tags de marcação no seu texto passam intactos, então, se um
deles sair distorcido, isso é um bug que vale a pena relatar, e não um
problema de layout.

## Usando

1. Na aba **Dados**, marque **Pseudo Test** em *Idiomas de destino* e salve.
2. Rode uma tradução normalmente. As entradas do Pseudo Test são sempre
   tratadas pelo gerador pseudo interno — não há nada para ativar, nenhuma
   regra de roteamento para escrever, e nenhum custo. Seus provedores pagos
   nunca veem essas strings.
3. Suas traduções reais estão seguras: o texto do Pseudo Test fica em sua
   própria coluna e nunca pode sobrescrever outro idioma.

## Levando para o seu jogo

No cartão de exportação, defina **Exportar o texto pseudo como** para um idioma
que você não está enviando no momento — o alemão, por exemplo — depois baixe
o arquivo e carregue-o no jogo com esse idioma selecionado. A coluna do
idioma escolhido é preenchida com o texto do Pseudo Test só para esse único
download; nada armazenado muda, e as traduções reais continuam lá na próxima
exportação.

Quando terminar os testes, exporte de novo com a substituição definida de
volta para **Sem substituição**. Uma exportação normal nunca contém uma
coluna do Pseudo Test — o texto pseudo só chega ao seu jogo pela substituição
acima — então deixar o Pseudo Test ativado não afeta os arquivos que você
publica.

## Quando usar

Faça uma passagem de pseudo cedo, antes de encomendar qualquer tradução. Todo
bug de layout que ela encontra é um que você corrige uma vez, em vez de
quinze vezes depois que quinze idiomas chegarem.
