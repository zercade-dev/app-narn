# Memoria di traduzione

## Panoramica

La **Memoria di traduzione** (TM) è un archivio di traduzioni note valido
per tutta l'area di lavoro. Quando il testo di origine di una stringa
corrisponde a uno già presente in memoria, la traduzione salvata viene
riutilizzata automaticamente invece di chiamare un modulo a pagamento —
risparmiando tempo e costi e mantenendo coerente il testo identico tra
progetti. Apri la vista **Memoria di traduzione** dalla barra laterale per
sfogliare e cercare i segmenti salvati.

> **La memoria di traduzione è disattivata per impostazione predefinita**
> per ogni progetto. Finché è disattivata, nulla di ciò che un progetto
> traduce viene scritto in memoria e nessuna traduzione salvata viene
> applicata automaticamente. Per attivarla, apri la scheda
> **Configurazione** del progetto e scegli una politica di riutilizzo nella
> sezione **Memoria di traduzione** (qualsiasi valore diverso da
> *Disattivata*).

## Come le voci entrano in memoria

- **Approva in memoria** — nella scheda **Traduzioni**, seleziona le
  traduzioni e approvale; vengono registrate come segmenti attendibili.
- Anche le traduzioni completate vengono registrate, così un testo di
  origine identico potrà riutilizzarle in seguito.

## Politica di riutilizzo

La politica di riutilizzo (nella scheda **Configurazione** del progetto,
sezione **Memoria di traduzione**) controlla *se* e *quando* una traduzione
salvata viene riutilizzata per un testo di origine identico. Per
impostazione predefinita è **Disattivata** (TM spenta); altre scelte — per
esempio **Rigorosa (corrispondenza di contesto completa)**, che riutilizza
solo quando corrisponde anche il contesto circostante — la attivano.
Restringere la politica evita di riutilizzare una traduzione che era
corretta in un punto ma non in un altro.

## Controllare il riutilizzo per singola esecuzione

Quando avvii una traduzione dalla finestra *Traduci…* della scheda
**Confronto**, un avviso ti dice quante voci verrebbero compilate dalla
memoria, e puoi **disattivare la memoria per questa esecuzione** per
forzare la ritraduzione da zero di ogni voce — utile quando vuoi che il
modello riconsideri un testo già memorizzato in precedenza.
