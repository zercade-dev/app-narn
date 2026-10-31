# Scheda Configurazione

## Panoramica

La scheda **Configurazione** contiene la politica di traduzione del
progetto selezionato: le scelte di modello per modulo, il riutilizzo della
memoria di traduzione, il raggruppamento dei batch, i controlli di qualità
(LQA) e la gestione del progetto. Le sue **lingue** e l'**importazione/
esportazione CSV** vivono ora nella scheda **Dati**, separata. Le
credenziali dei provider non si impostano qui — vivono nella **cassaforte
delle credenziali** (vedi le guide *Configura un modulo* e
**Configurazione globale**).

## Lingue (nella scheda Dati)

Imposta la **lingua di origine** e le **lingue di destinazione** verso cui
tradurre nella scheda **Dati**. L'insieme attivo delle lingue di
destinazione guida ogni altra scheda — le colonne delle voci, le regole di
routing e i controlli di qualità lo seguono tutti.

## Importazione ed esportazione CSV (nella scheda Dati)

L'importazione e l'esportazione CSV vivono anch'esse nella scheda **Dati**:

- **Importazione CSV** carica le voci di origine e le eventuali traduzioni
  già presenti nel file. Un'istantanea di sicurezza viene creata
  automaticamente subito prima di ogni importazione, così puoi tornare
  indietro dalla scheda **Backup**.
- Le righe che non possono essere analizzate correttamente (una virgoletta
  seguita immediatamente da una virgola) vengono scartate e segnalate,
  invece di essere scritte come dati con le colonne spostate.
- **Esportazione CSV** scarica il progetto; puoi scegliere le lingue e se
  includere la colonna del contesto per il traduttore.

### File di script client

Un CSV con una colonna **Text Mapping ID** è un file di script client. Viene importato in una raccolta propria, **Testo dello script client**, separata dal **Testo principale**: il pannello di importazione indica quale ha rilevato.

* Ogni stringa client è identificata dal suo Text Mapping ID, quindi lo stesso inglese può comparire in entrambe le raccolte, e su più righe client, senza essere unito.
* Importare un file client non modifica mai il testo principale, e importare un file principale non modifica mai il testo client.
* Quando l'inglese di una chiave esistente cambia, in entrambe le modalità di importazione, la vecchia riga passa nella scheda **Orfane** e quella nuova mantiene le traduzioni del file; solo le sue celle vuote restano da tradurre. Usa **Ricollega** per trasferire le traduzioni: la riga con la stessa chiave viene proposta per prima, e la modalità di sovrascrittura decide se le celle già compilate vengono mantenute o sostituite.
* Quando un progetto ha stringhe client, l'**Esportazione CSV** permette di scegliere quale raccolta scaricare, e un'esportazione client mantiene la colonna Text Mapping ID.
* Le esportazioni scrivono il testo così come è salvato, senza aggiungere un apostrofo davanti alle celle che iniziano con = + - o @. Attiva **Proteggi per i fogli di calcolo** solo per i file che aprirai in un foglio di calcolo, perché l'editor di Miliastra conserva quell'apostrofo come testo. Le esecuzioni di traduzione saltano le righe con valore Need translation? uguale a FALSE.

## Moduli e modelli

Attiva i provider una sola volta in **Configurazione globale**. Qui, in
Configurazione, scegli, per singolo progetto, il **modello** e il
**livello di ragionamento** di ciascun modulo attivo — oppure li lasci
impostati su *Eredita dalla configurazione globale*. Quale modulo viene
effettivamente eseguito per una data voce è deciso dalle **regole di
routing** (vedi la guida *Routing*).

## Controlli LQA

Il pannello **Controlli LQA** configura il gate di qualità eseguito su ogni
traduzione: attiva o disattiva i singoli controlli (uguaglianza dei tag,
limite di lunghezza, overflow, aderenza al glossario, termini vietati,
asserzioni regex e altro) e imposta ciascuno su **Bloccante** o **Avviso**.
Le anomalie bloccanti fanno fallire il gate e possono attivare un tentativo
automatico; gli avvisi vengono solo segnalati.

## Raggruppamento dei batch

Il **raggruppamento dei batch** mantiene insieme le voci correlate (per
categoria e/o glossario) nella stessa richiesta, così il modello le vede
nel loro contesto. Puoi impostare un valore predefinito per il progetto e
sovrascriverlo per singola esecuzione.

## Gestione del progetto

La **Zona pericolosa** ti permette di **Duplicare** il progetto
(configurazione e voci, mai i segreti) oppure di **Eliminarlo**
definitivamente.
