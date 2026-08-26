# Domande e risposte

## Panoramica

Risposte brevi ai dubbi che ricorrono più spesso, ciascuna con un rimando alla guida che tratta l'argomento per esteso. L'elenco cresce man mano che arrivano nuove domande, quindi se la tua non c'è ancora, l'elenco dei temi a sinistra entra molto più nel dettaglio.

## Che cosa viene tradotto

### Quali voci traduce un'esecuzione, e quali salta?

Solo quelle che ne hanno ancora bisogno. Per ogni voce e ogni lingua di destinazione selezionata, l'esecuzione traduce quella coppia quando non ha ancora una traduzione — oppure quando hai chiesto esplicitamente di **ritradurre**. Una coppia che ha già del testo viene lasciata com'è, quindi rilanciare una traduzione non sovrascrive mai il lavoro che hai già fatto o revisionato.

Una voce, o una singola coppia voce-lingua, resta fuori quando è vera una qualsiasi di queste condizioni:

* **È già tradotta**, e non hai chiesto di ritradurre.
* **L'hai contrassegnata come Ignorata.** Questo la esclude da *tutte* le operazioni con IA — traduzione, revisione IA, revisione della fonte e generazione di glossari o categorie. Le voci ignorate restano visibili nella tabella con un badge, così la decisione è sempre visibile e sempre reversibile.
* **È orfana** — è sparita dall'ultimo import CSV e attende nella scheda [Orfane](guide:usage-orphans).
* **È stata importata con `Hai bisogno di una traduzione? = FALSE`.**
* **La destinazione è la lingua di origine.** Una voce non viene mai tradotta nella propria lingua di origine, anche se selezioni quella lingua come destinazione.
* **Non c'è nulla da tradurre.** Testo vuoto, un numero come `3.14` o `100%`, un colore esadecimale come `#ff8800`, o una stringa fatta solo di tag e segnaposto come `<b>{count}</b>` vengono ricopiati invariati, senza chiamare alcun provider.

Anche una voce riempita dalla [Memoria di traduzione](guide:usage-translation-memory) non raggiunge mai un provider — viene riusata la traduzione salvata. Conta comunque come tradotta.

### Posso ritradurre qualcosa che è già tradotto?

Sì, ma devi chiederlo, perché le esecuzioni saltano per impostazione predefinita le coppie già concluse. Spunta **ritraduci** nella finestra *Traduci…* per un lotto, oppure usa **Ritraduci** su una singola riga nella scheda [Confronto](guide:usage-compare) o nella coda di revisione manuale.

### Perché una voce è tornata con il testo di origine invariato?

Quasi sempre perché non c'era nulla da tradurre — l'ultimo punto dell'elenco qui sopra. Numeri, colori e markup puro vengono riconosciuti e ricopiati così come sono, perché un modello può solo ripeterli o rovinarli. Per quelle voci non è stato inviato nulla a un provider e non è stato addebitato nulla.

## Provider, modelli e routing

### Come cambio il modello usato per le traduzioni?

Ci sono tre livelli, e quello che ti serve dipende da quanto vuoi che il cambiamento sia ampio:

1. **Per un provider ovunque** — apri la **Configurazione globale**, trova il modulo e scegli lì il suo **modello**. Ogni progetto impostato su *Eredita dalla configurazione globale* lo segue.
2. **Per un solo progetto** — apri la scheda [Configurazione](guide:usage-config) di quel progetto e imposta il **modello** (e lo **sforzo di ragionamento**) per il modulo, invece di ereditarli.
3. **Solo per alcune voci** — apri la scheda [Routing](guide:usage-routing), passa a **Avanzate** e imposta un **modello personalizzato** su una regola di routing. Lo usano soltanto le voci che corrispondono a quella regola.

La vista semplice della scheda Routing sceglie un **provider**, non un modello: esegue deliberatamente il modello con cui quel modulo è già configurato.

### Lingue diverse possono usare provider diversi?

Sì. Porta la scheda [Routing](guide:usage-routing) su **Avanzate** e aggiungi una regola per lingua — oppure per categoria, o per lunghezza della voce. Le regole vengono valutate in ordine di priorità e vince la prima che corrisponde a una voce. Se preferisci non scegliere affatto, punta una sola regola su [NARN Freeway](guide:usage-freeway) e lascia che scelga un modello gratuito per ogni lotto.

### La traduzione non parte e dice che non c'è nessuna regola di routing. E adesso?

Un'esecuzione parte solo quando ogni lingua che contiene ha una destinazione. Se una lingua di destinazione non corrisponde a nessuna regola, l'esecuzione viene rifiutata prima di inviare qualsiasi cosa e il messaggio nomina la lingua. Apri la scheda [Routing](guide:usage-routing) e aggiungi una regola che la copra — il selettore semplice di provider le copre tutte in un colpo — poi rilancia.

## Esecuzioni, errori e recupero

### Alcune stringhe sono fallite. Devo rilanciare tutto?

No. Usa **Riprova le fallite** sull'esecuzione, nella scheda [Attività](guide:usage-activity): rilancia solo le coppie voce-lingua andate in errore e lascia intatto tutto ciò che è riuscito.

### Perché devo sbloccare di nuovo la cassaforte?

La [cassaforte delle credenziali](guide:usage-vault) si sblocca per sessione, non in modo permanente, e si richiude anche da sola dopo un po' di inattività. Sbloccala e vai avanti. Se un'esecuzione era in corso quando si è bloccata, usa poi **Riprova le fallite** su quell'esecuzione.

### Ho reimportato il CSV e alcune traduzioni sono sparite. Sono perse?

No. Quando una reimportazione non contiene più una voce, le sue traduzioni restano nella scheda [Orfane](guide:usage-orphans) invece di essere cancellate. **Ricollega** un'orfana alla voce che l'ha sostituita per spostarci le traduzioni; sulla destinazione vengono riempite solo le lingue vuote, quindi non si sovrascrive nulla. Inoltre, subito prima di ogni import viene creata automaticamente un'istantanea, così puoi riportare indietro l'intero progetto dalla scheda [Backup](guide:usage-backup).
