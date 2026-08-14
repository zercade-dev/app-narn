# Configurazione rapida

## Panoramica

Il percorso completo per un nuovo progetto: attiva i provider, importa le
tue voci, configura glossari e routing, traduci e revisiona. I passaggi
contrassegnati come *(Optional)* migliorano la qualità ma non sono
necessari per una prima traduzione — saltali al primo passaggio e torna a
occupartene più tardi.

## 1. Attiva i provider e salva le credenziali

1. Apri **Configurazione globale** e **attiva un modulo** per ogni provider
   che vuoi usare (Anthropic, OpenAI, DeepL e così via). Un modulo può avere
   diverse **istanze denominate** — utile per due configurazioni dello
   stesso provider con chiavi o valori predefiniti diversi.
2. Le credenziali dei provider sono conservate nella **cassaforte delle
   credenziali** cifrata — configurala al primo utilizzo e sbloccala una
   volta per sessione. Consulta la guida *Cassaforte delle credenziali* per
   sapere come funziona.
3. Scegli un **modello** (ed eventualmente un **livello di ragionamento**)
   per ogni modulo o istanza. I modelli più economici traducono peggio,
   quindi aspettati qualche tentativo prima di trovare il tuo equilibrio
   ideale. Fai attenzione al **livello di ragionamento**: sui modelli di
   ragionamento può moltiplicare rapidamente la spesa.

## 2. Crea il progetto e importa le voci

Crea un progetto, imposta la sua **lingua di origine**, quindi usa
**Importazione CSV** nella scheda **Dati** per caricare le tue voci di
origine (e le eventuali traduzioni già presenti nel file).

## 3. *(Optional)* Revisiona prima il tuo testo di origine

Esegui una **Revisione IA origine** sulla lingua di origine prima di
tradurre — correggere refusi e frasi poco chiare qui avvantaggia ogni
traduzione fatta in seguito. Se una correzione modifica una voce che aveva
già delle traduzioni, le vecchie traduzioni finiscono nella scheda
**Orfane** — **ricollegale**, con un'eventuale ritraduzione.

## 4. *(Optional)* Attiva i glossari

Nella scheda **Glossario**, attiva i glossari che si applicano al tuo
progetto. L'applicazione automatica trova le corrispondenze dei termini come
**parole intere, senza distinzione tra maiuscole e minuscole** — le forme
flesse (plurali, coniugazioni) non vengono riconosciute. Traduci con
**DeepL**? Invia i glossari con **Invia a DeepL** (in alto a destra), e
invia di nuovo dopo averli modificati.

## 5. Configura il routing

Apri la scheda **Routing** e scegli il tuo provider dal selettore su cui si
apre — questo invia ogni voce del progetto a quel provider, che è tutto ciò
di cui ha bisogno una configurazione a provider singolo. Vuoi provider
diversi per lingua, categoria o lunghezza della voce? Passa ad **Avanzata**
e aggiungi lì le **regole di routing**. In entrambi i casi la tua scelta
viene salvata automaticamente. Questo passaggio è obbligatorio: una voce
senza una regola corrispondente non viene tradotta e restituisce un errore
*"no route"*.

## 6. *(Optional)* Costruisci i glossari a partire dai tuoi contenuti

Fai crescere i tuoi glossari prima della traduzione in blocco: aggiungi
termini manualmente, esegui **Genera i glossari** sull'intera origine oppure
— in modo più mirato — seleziona le voci candidate migliori in
**Traduzioni** e usa **Genera un glossario dalla selezione** (includendo le
traduzioni esistenti). Usa un modello capace per questo passaggio: la
qualità del glossario si ripercuote su tutto ciò che viene tradotto in
seguito.

## 7. *(Optional)* Perfeziona prima la qualità in Confronto

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

## 8. Traduci

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

## 9. Revisiona l'esecuzione

Scegli tra:

- Avvia una **Revisione IA** per l'esecuzione completata dalla scheda
  **Attività**.
- Revisiona a mano in **Revisione manuale** o in **Confronto**.
- Approva tutto così com'è e revisiona più tardi.
