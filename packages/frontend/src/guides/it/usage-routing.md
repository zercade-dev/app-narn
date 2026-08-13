# Scheda Routing

## Panoramica

La scheda **Routing** decide quale modulo e modello gestisce ogni voce. Si
apre su un selettore di provider singolo: scegli un provider e ogni voce
del progetto vi viene inviata. È tutto ciò di cui la maggior parte dei
progetti ha bisogno.

Ti serve più di una destinazione? Passa la scheda ad **Avanzata** e compare
l'editor completo delle regole, dove il routing può variare per lingua di
destinazione, categoria o lunghezza della voce, e dove puoi mantenere più
gruppi di regole denominati. La scheda ricorda quale delle due modalità hai
usato l'ultima volta. Un progetto il cui routing è più ricco di un singolo
provider mostra sempre l'editor completo, qualunque modalità tu abbia
scelto — una configurazione esistente non ti viene mai nascosta.

In entrambi i casi, questa scheda decide solo *come* vengono smistate le
voci. Le traduzioni si avviano dalla scheda **Traduzioni** o **Confronto**.

## Regole di routing

Le regole vivono nella vista **Avanzata**. Vengono valutate in ordine di
priorità; la prima che corrisponde a una voce vince. Ogni regola può fare
corrispondere:

- **Origini** — le etichette di origine delle voci importate.
- **Limite di lunghezza della voce** — si applica solo alle voci con un
  numero di caratteri pari o inferiore a un dato limite.
- **Lingua di destinazione** e **categorie**.

Per le voci corrispondenti la regola imposta il **modulo** (con
un'eventuale sostituzione di **modello** e **livello di ragionamento**) più
suggerimenti facoltativi per il prompt (personaggio, tono, genere, note).
Aggiungi regole con **Aggiungi una regola**; ogni modifica viene salvata
per te man mano che la fai, quindi non c'è nessun pulsante **Salva** da
ricordare. Puoi mantenere più **gruppi di regole** denominati e passare
dall'uno all'altro (il cambio è bloccato mentre è in corso un'esecuzione).

## Raggruppamento dei batch

La scheda Routing ha anche un controllo di **Raggruppamento dei batch** —
lo stesso valore predefinito per progetto mostrato nella scheda
Configurazione, con un corrispondente interruttore **Ignora il limite di
dimensione del batch**. Mantiene le voci correlate nella stessa richiesta
al provider durante le esecuzioni di traduzione, valutazione e revisione
dell'origine.

## Avviare una traduzione

1. Seleziona le voci nella scheda **Traduzioni** o **Confronto**.
2. Apri da lì la finestra **Traduci…** — offre opzioni di ritraduzione,
   memoria e raggruppamento per singola esecuzione, poi avvia l'esecuzione.
3. Segui l'avanzamento, i tentativi ripetuti e gli errori nella scheda
   **Attività**.
