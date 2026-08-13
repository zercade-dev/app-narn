# Revisione IA

## Panoramica

Oltre ai controlli LQA automatici, l'app può usare un modello IA per
revisionare i tuoi contenuti. Ci sono due schede di revisione IA più una
coda di revisione manuale. Ogni revisione IA richiede un modulo LLM attivo
in **Configurazione globale** e la cassaforte delle credenziali sbloccata.

## Revisione IA traduzioni

La scheda **Revisione IA traduzioni** fa valutare da un'IA le traduzioni
completate in base ad **accuratezza, fluidità, terminologia e tono**.

- Fai clic su **Revisiona l'ultima esecuzione** per far valutare l'ultima
  esecuzione di traduzione completata (oppure avvia una revisione da
  un'esecuzione specifica nella scheda **Attività**).
- Scorri i risultati contrassegnati; ogni verdetto mostra l'origine, la
  traduzione, un **punteggio** e spesso un **suggerimento**.
- **Applica** un suggerimento per sostituire la traduzione, oppure
  **Applica tutti i suggerimenti** per applicarli tutti in un solo
  passaggio. Un avviso compare se un suggerimento eliminerebbe tag,
  segnaposto o interruzioni di riga.

## Revisione IA origine

La scheda **Revisione IA origine** controlla **il testo di origine
stesso** — è solo informativa e non modifica mai le traduzioni.

1. Scegli i controlli da eseguire: **refuso**, **grammatica**,
   **terminologia**, **chiarezza** e **contenuti a rischio**.
2. Scegli il **modulo** e il **modello**, ed eventualmente la **lingua
   della risposta** per i rilievi.
3. Fai clic su **Avvia la revisione**. Viene eseguita in background — segui
   l'avanzamento nella scheda **Attività**.
4. Revisiona ogni rilievo e **Approva** o **Ignora**; una riscrittura
   dell'origine suggerita può essere copiata.

## Revisione manuale

La scheda **Revisione manuale** è una coda di revisione umana. Le
traduzioni contrassegnate come **Da revisionare** (o **Contrassegnate**)
compaiono qui, dove puoi **Approva**, **Modifica**, **Contrassegna**,
**Ritraduci** oppure richiedere una **retrotraduzione** verso l'origine
come riferimento. Le scorciatoie da tastiera velocizzano il lavoro: `↑`/`↓`
per spostarti, `a` per approvare, `e` per modificare.
