# Scheda Qualità

## Panoramica

La scheda **Qualità** è un pannello che aggrega i risultati LQA (Language
Quality Assurance) prodotti ogni volta che le voci vengono tradotte. Mostra
il tuo tasso di superamento complessivo e dove si concentrano le anomalie,
così puoi individuare rapidamente le aree problematiche. Si popola man mano
che traduci — se è vuoto, esegui prima una traduzione.

## Cosa mostra

- **Tasso di superamento complessivo** su tutti i risultati LQA e le voci
  che coprono.
- **Tasso di superamento per lingua** — la qualità per ogni lingua di
  destinazione.
- **Anomalie per origine** — conteggi per tipo di anomalia raggruppati per
  etichetta di origine.
- **Qualità per modulo** — tasso di superamento e anomalie raggruppati per
  il modulo che ha prodotto ciascuna traduzione.

## Approfondire

Fai clic su qualsiasi cella per passare alle voci corrispondenti — il
pannello filtra la tabella **Traduzioni** fino alle voci interessate, così
puoi correggerle.

## Da dove vengono i controlli

Ogni traduzione passa attraverso il gate LQA, che esegue i controlli
attivati nel pannello *Controlli LQA* della scheda **Configurazione**
(uguaglianza dei tag, limite di lunghezza, overflow, aderenza al glossario,
termini vietati, asserzioni regex e altro). I controlli **Bloccanti** fanno
fallire il gate e possono attivare un tentativo automatico; i controlli
**Avviso** vengono segnalati qui senza bloccare. Regola quali controlli
vengono eseguiti, e la loro gravità, in Configurazione.
