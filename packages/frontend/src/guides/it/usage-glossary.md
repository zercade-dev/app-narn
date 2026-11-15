# Scheda Glossario

## Panoramica

La scheda **Glossario** mantiene coerente la terminologia. Un progetto può
contenere più glossari; ciascuno è un elenco di termini di origine con una
traduzione per ogni lingua di destinazione. I glossari vengono confrontati
automaticamente con le voci e i termini corrispondenti vengono passati al
modello durante la traduzione.

## Glossari e termini

- Crea un glossario con **Nuovo glossario**; rinominalo o eliminalo in
  seguito.
- **Attiva** o **disattiva** un glossario — un glossario disattivato viene
  ignorato durante l'importazione e la traduzione.
- Aggiungi termini con un'**origine**, una **traduzione per lingua** e
  **note** facoltative.
- Contrassegna un termine come **costante** quando deve uscire esattamente come è scritto nel glossario, come il nome di un personaggio o un marchio — vedi *Termini costanti* più sotto.
- Un glossario ha due schede: **Termini** elenca i suoi termini e **Corrispondenze** elenca le voci che li contengono, dove puoi assegnare il glossario alle voci o toglierlo.

Alcuni glossari sono **di sola lettura** (gestiti a livello globale) e
contribuiscono termini senza essere modificabili qui.

## Termini costanti

- Un termine costante **non viene mai inviato al motore di traduzione**. NARN lo sostituisce con un segnaposto prima di tradurre e poi mette al suo posto la traduzione del glossario, così un nome di personaggio come *Diluc* esce sempre esattamente come è scritto nel glossario.
- **Le maiuscole contano.** È protetto solo il testo scritto esattamente come il termine: *Venti* (il personaggio) sì, *a venti latte* no. Ogni altra grafia viene inviata al motore come un normale suggerimento del glossario, segnato come nome, così può distinguere il nome dalla parola comune.
- **Il motore non può modificare la parola.** Dato che non vede mai il termine, non può declinarlo né accordarvi altre parole: in lingue come il russo, il coreano o il turco un nome costante compare sempre nella sua forma base. Usa costante per nomi e codici che devono restare fissi.
- Lascia come termini normali i nomi che sono anche parole comuni, perché titoli ed etichette spesso li scrivono con la maiuscola (*Gaming Settings*). Nei glossari inclusi sono costanti i nomi dei personaggi, le nazioni e i nomi di prodotto Genshin Impact, Miliastra Sandbox e Miliastra Wonderland, tranne Gaming, Amber, Razor, Sucrose, Prune, Traveler e Wanderer.

## Importazione ed esportazione

Importa termini da **CSV** o **TBX** — un'anteprima mostra quanti termini
vengono aggiunti, aggiornati o in conflitto prima di applicare. Esporta il
glossario di nuovo in **CSV** o **TBX**.

## Genera con l'IA

- **Genera i glossari** analizza il testo di origine e propone glossari di
  nomi ricorrenti e termini personalizzati. Viene eseguito in background —
  seguilo nella scheda **Attività** ed esamina i suggerimenti prima di
  crearli. Puoi passare i glossari esistenti come “già noti” così il
  modello non li ripete.
- **Genera le traduzioni** compila le traduzioni di destinazione per i
  termini a cui mancano ancora.

## DeepL

Se traduci con DeepL, usa **Invia a DeepL** per caricare i termini del
glossario. Dopo aver modificato un glossario già inviato, la scheda mostra
*Nuovo invio necessario* — invia di nuovo per aggiornare DeepL.

## Controllo per singola voce

Dalla scheda Traduzioni puoi scegliere quali glossari sono **attivi** per
una singola voce.
