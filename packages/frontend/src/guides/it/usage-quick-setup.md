# Configurazione rapida

## Panoramica

Sei nuovo su NARN? Il percorso breve qui sotto ti porta da zero a una traduzione esportata in cinque passaggi. La configurazione guidata nell'app ti accompagna negli stessi passaggi, e puoi saltarla e riprenderla più tardi — **Continua la configurazione** nella barra laterale riparte da dove eri rimasto, e puoi riavviarla da questa Guida. Tutto ciò che segue il percorso breve è per quando vuoi più controllo.

## Il percorso breve

1. **Crea la password della cassaforte.** Le tue chiavi dei provider sono cifrate con essa — vedi la guida [Cassaforte delle credenziali](guide:usage-vault). Nella versione cloud, i passaggi 1 e 2 si fanno insieme nella pagina della cassaforte.
2. **Aggiungi una chiave gratuita.** Una chiave Google AI è il modo più semplice per iniziare — ottienila su [aistudio.google.com/apikey](https://aistudio.google.com/apikey), oppure scegli **Usa il mio provider**. [NARN Freeway](guide:usage-freeway) sceglie poi i modelli gratuiti per te.
3. **Crea un progetto e importa il testo.** Crea un progetto, poi nella scheda **Dati** scegli la lingua di origine e le lingue in cui tradurre, e usa **Importazione CSV**.
4. **Traduci.** In **Traduzioni**, seleziona tutte le voci e fai clic su **Traduci**. NARN Freeway sceglie i modelli gratuiti per te; segui l'avanzamento in **Attività**.
5. **Esporta.** Scarica il file tradotto dal progetto.

I nuovi utenti iniziano in **modalità Semplice**, che mostra solo Configurazione, Dati, Traduzioni e Attività (più Guida, Impostazioni e **Chiavi dei provider**). Passa tra **Semplice** e **Avanzata** dalla barra superiore o nelle Impostazioni quando vuoi.

## Quando vuoi di più

Questi passaggi si trovano nella **modalità Avanzata** e migliorano la qualità o danno un controllo più fine. I passaggi contrassegnati *(Optional)* non servono per una prima traduzione — saltali e torna più tardi. La prima volta che apri Routing, Glossario, Qualità, Confronto o Revisione IA traduzioni in modalità Avanzata viene proposto un breve tour; puoi riavviare qualsiasi tour da questa Guida, oppure disattivare le proposte nelle Impostazioni.

## Aggiungi altri provider e credenziali

1. Apri **Configurazione globale** e **attiva un modulo** per ogni provider che vuoi usare (Anthropic, OpenAI, DeepL e così via) dall'elenco **Attiva un modulo** — DeepL compare con il proprio nome, mentre i provider IA appaiono come **Aggiungi un'altra istanza di …**, che crea la prima istanza del provider. Un modulo può avere diverse **istanze denominate** — utile per due configurazioni dello stesso provider con chiavi o valori predefiniti diversi.
2. Le credenziali dei provider sono conservate nella **cassaforte delle
   credenziali** cifrata — configurala al primo utilizzo e sbloccala una
   volta per sessione. Consulta la guida *Cassaforte delle credenziali* per
   sapere come funziona.
3. Scegli un **modello** (ed eventualmente un **livello di ragionamento**)
   per ogni modulo o istanza. I modelli più economici traducono peggio,
   quindi aspettati qualche tentativo prima di trovare il tuo equilibrio
   ideale. Fai attenzione al **livello di ragionamento**: sui modelli di
   ragionamento può moltiplicare rapidamente la spesa.

## *(Optional)* Revisiona prima il tuo testo di origine

Esegui una **Revisione IA origine** sulla lingua di origine prima di
tradurre — correggere refusi e frasi poco chiare qui avvantaggia ogni
traduzione fatta in seguito. Se una correzione modifica una voce che aveva
già delle traduzioni, le vecchie traduzioni finiscono nella scheda
**Orfane** — **ricollegale**, con un'eventuale ritraduzione.

## *(Optional)* Attiva i glossari

Nella scheda **Glossario**, attiva i glossari che si applicano al tuo
progetto. L'applicazione automatica trova le corrispondenze dei termini come
**parole intere, senza distinzione tra maiuscole e minuscole** — le forme
flesse (plurali, coniugazioni) non vengono riconosciute. Traduci con
**DeepL**? Invia i glossari con **Invia a DeepL** (in alto a destra), e
invia di nuovo dopo averli modificati.

## Configura il routing

Apri la scheda **Routing** e scegli il tuo provider dal selettore su cui si
apre — questo invia ogni voce del progetto a quel provider, che è tutto ciò di
cui ha bisogno una configurazione a provider singolo. Vuoi provider diversi
per lingua, categoria o lunghezza della voce? Passa ad **Avanzata** e aggiungi
lì le **regole di routing**. In entrambi i casi la tua scelta viene salvata
automaticamente. Un progetto senza alcuna regola invia tutto tramite NARN
Freeway, quindi all'inizio questo passaggio è facoltativo. Quando il progetto
ha delle regole, una voce che non ne soddisfa nessuna non viene tradotta e
restituisce un errore *"no route"*.

## *(Optional)* Costruisci i glossari a partire dai tuoi contenuti

Fai crescere i tuoi glossari prima della traduzione in blocco: aggiungi
termini manualmente, esegui **Genera i glossari** sull'intera origine oppure
— in modo più mirato — seleziona le voci candidate migliori in
**Traduzioni** e usa **Genera un glossario dalla selezione** (includendo le
traduzioni esistenti). Usa un modello capace per questo passaggio: la
qualità del glossario si ripercuote su tutto ciò che viene tradotto in
seguito.

## *(Optional)* Perfeziona prima la qualità in Confronto

Prima di un'esecuzione di traduzione completa, usa la scheda **Confronto**
per mettere a punto una lingua che puoi valutare personalmente:

- Affina il **contesto** di ogni voce (personaggio, tono, note) e i
  glossari finché la traduzione non suona giusta. Il contesto è associato
  alla voce, non alla lingua, quindi il lavoro si riporta automaticamente
  su ogni altra lingua.
- Dato che stai procedendo voce per voce, qui va bene anche un modello
  economico o gratuito — per esempio una chiave Gemini gratuita (vedi la
  guida *Google AI (Gemini)*), aggiunta come propria **istanza del modulo**
  con il routing puntato temporaneamente su di essa. Il livello gratuito ha
  un limite giornaliero, quindi preferisci richieste raggruppate.
- Soddisfatto dei risultati? Traduci l'intero batch una volta con le stesse
  impostazioni per confermare che il risultato regge anche in blocco.

## Traduci in blocco

Due modi per eseguire la traduzione vera e propria:

- **Traduzioni** — seleziona le voci e **Traduci la selezione** per
  coprire tutte le lingue di destinazione in una volta.
- **Confronto** — una lingua alla volta, con eventualmente una lingua già
  revisionata come contesto di **riferimento**.

Per un progetto completo, di solito conviene procedere una lingua alla
volta con una lingua di riferimento revisionata: la revisione IA successiva
resta concentrata su una sola lingua. Segui l'avanzamento nella scheda
**Attività**.

Il raggruppamento in batch è automatico per impostazione predefinita; per
un progetto piccolo con molte voci brevi, una dimensione del batch
personalizzata pari a **0** (l'intera lingua in un'unica richiesta) può
funzionare meglio con un modello capace.

## Revisiona l'esecuzione

Scegli tra:

- Avvia una **Revisione IA** per l'esecuzione completata dalla scheda
  **Attività**.
- Revisiona a mano in **Revisione manuale** o in **Confronto**.
- Approva tutto così com'è e revisiona più tardi.
