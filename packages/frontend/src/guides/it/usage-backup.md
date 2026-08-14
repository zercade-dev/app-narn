# Scheda Backup

## Panoramica

La scheda **Backup** racchiude un progetto — la sua configurazione, le voci
e il glossario — in un archivio `.zip` verificabile. Ogni file è dotato di
checksum, e i checksum vengono verificati prima che qualsiasi cosa venga
riscritta al ripristino.

## Creare un backup

1. Seleziona un progetto.
2. Apri la scheda **Backup**.
3. Fai clic su **Crea un backup**.
4. Il nuovo archivio compare in **Backup salvati**, dove puoi fare clic su
   **Scarica**.

## Backup automatici

L'app crea anche istantanee di sicurezza per te, elencate insieme ai backup
manuali:

- **Prima di un'importazione CSV** — un punto di ripristino da poco prima
  dell'importazione.
- **Prima di una ritraduzione** — un punto di ripristino da poco prima che
  le voci venissero sovrascritte.

Configurazione globale imposta il **Numero massimo di backup per
progetto** (predefinito 10); i backup più vecchi oltre questo limite
vengono eliminati.

## Ripristinare

1. In **Ripristino da un backup**, seleziona un file `.zip` (oppure scegli
   uno dei backup salvati).
2. L'app verifica i checksum e mostra un'anteprima (progetto, file, data di
   creazione).
3. Conferma. Il ripristino sovrascrive la configurazione, le voci e il
   glossario attuali del progetto — questa operazione non può essere
   annullata, quindi crea un backup fresco prima se hai dei dubbi.

## Eliminare

Usa **Elimina** su un backup salvato per rimuovere definitivamente
quell'archivio dal server.
