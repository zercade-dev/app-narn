# Scheda Attività

## Panoramica

La scheda **Attività** è il centro di controllo dei processi in background.
Ogni attività di lunga durata compare qui: le esecuzioni di **traduzione**,
la **revisione IA** (delle traduzioni e dell'origine), la generazione dei
glossari e la generazione delle categorie. Le esecuzioni vengono messe in
coda e serializzate per progetto, così puoi accodarne diverse e seguirle
mentre procedono.

## Leggere un'esecuzione

Ogni esecuzione mostra il proprio **tipo**, lo **stato** (In coda, In corso,
In pausa, Completata, Non riuscita o Annullata), l'avanzamento e un
**costo** stimato. I costi sono stime riportate dai moduli, derivate dal
prezzo per milione di token di ciascun modello, quindi i modelli di
ragionamento possono mostrare totali di token elevati rispetto ai
caratteri. Usa **Mostra i dettagli** per vedere esattamente cosa ha tradotto
un'esecuzione, gli eventuali tentativi ripetuti e l'uso di caratteri e
token. Puoi copiare l'id di un'esecuzione come riferimento.

## Gestire la coda

- **Metti in pausa** / **Riprendi** un'esecuzione, oppure **Avvia subito**
  per far passare avanti un'esecuzione in coda.
- **Sposta in su** / **Sposta in giù** per riordinare la coda.
- **Annulla** un'esecuzione in coda o in corso.

## Recuperare e revisionare

- Se alcune voci non sono riuscite, **Riprova le non riuscite** ripete solo
  quelle.
- Su un'esecuzione di traduzione completata, avvia una **Revisione IA**
  direttamente dall'esecuzione — scegli il modulo e il modello (per
  impostazione predefinita sono quelli usati per la traduzione), poi apri i
  verdetti nella scheda **Revisione IA traduzioni**.
