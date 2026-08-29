# NARN Freeway

## Panoramica

**NARN Freeway** è un pool condiviso di modelli IA su piano gratuito a cui l'app instrada il lavoro automaticamente — senza carta di credito. Le chiavi dei provider restano le tue; quello che aggiunge Freeway è la contabilità. Tiene traccia di quanta quota gratuita resta a ciascun provider, sceglie un modello per ogni lotto e passa a un altro quando uno è limitato in frequenza o esaurito per la giornata.

Punta il routing su Freeway e non sceglierai mai più un modello: per il lavoro Freeway non esiste impostazione di modello né di sforzo di ragionamento, perché la scelta viene fatta lotto per lotto, lingua per lingua, tra ciò che il pool riesce a servire in quel momento.

## Come attivarlo

Un progetto appena creato, ancora senza regole di routing, offre il pulsante **Affida tutto a NARN Freeway** nella scheda [Routing](guide:usage-routing) — un clic crea una regola generale che punta al pool gratuito.

Altrimenti scegli **NARN Freeway** come qualsiasi altro provider: nel selettore semplice della scheda Routing per mandargli l'intero progetto, oppure come modulo di una singola regola in **Avanzate** per usarlo su alcune lingue e un provider a pagamento su altre.

Prima servono due cose: almeno un provider gratuito con la chiave salvata nella [cassaforte delle credenziali](guide:usage-vault), e la cassaforte sbloccata — finché è bloccata, ogni provider Freeway risulta senza chiave.

## Quali provider usa

Freeway attinge ai piani gratuiti dei provider che hai già configurato come moduli. Oggi sa usare:

* **Google AI (Gemini)** — la franchigia gratuita più ampia, e la fonte della maggior parte dei modelli più solidi del pool.
* **Groq** — veloce, con un conteggio giornaliero di richieste generoso.
* **OpenRouter** — i modelli gratuiti che ospita.
* **DeepL** — la franchigia mensile di caratteri del suo piano gratuito, per la traduzione automatica classica.

<!-- local-only -->

* **GitHub Copilot** — se hai un abbonamento Copilot.

<!-- /local-only -->

Un provider a cui non hai dato una chiave viene semplicemente saltato. Ogni chiave in più allarga il pool e rende meno probabile che un'esecuzione debba aspettare.

## Tenere d'occhio il pool

Il pannello **NARN Freeway** nella schermata di configurazione mostra tutto il pool a colpo d'occhio: lo stato della chiave di ogni provider e, per ciascun modello, il suo **Stato**, la quota **Rimanente**, il **Prossimo reset** e il recente **Tasso di superamento** per lingua.

Ogni provider ha anche un menu a tendina accanto che controlla come Freeway lo usa: **Automatico** lascia scegliere il pool come al solito, un'istanza con nome vincola Freeway a quell'account specifico, e **Disattivato** toglie del tutto il provider dal pool — senza spegnere il modulo altrove. Rimettere un provider disattivato su Automatico (o su un'istanza con nome) riprende esattamente da dove si era interrotto.

Lo stato di un modello è uno tra:

* **Pronto** — utilizzabile subito.
* **In raffreddamento** — limitato in frequenza per un attimo; torna da solo.
* **Esaurito per oggi** — la franchigia giornaliera è finita, e il pannello indica quando si azzera.
* **Modulo disattivato** — la chiave è salvata ma il modulo è spento. Il pannello propone di attivarlo.
* **Disattivato per Freeway** — hai disattivato questo provider per il pool dal suo menu a tendina; il resto del modulo resta invariato.
* **Nessuna chiave** — nella cassaforte non c'è ancora nulla per questo provider.
* **Credenziali non valide** — la chiave è stata rifiutata. Salva una chiave funzionante nella cassaforte per togliere il contrassegno.

## Quando la quota gratuita finisce

Un'esecuzione che esaurisce il pool non fallisce. Passa a **In attesa di quota gratuita**, conserva le coppie ancora da fare e riparte da sola non appena la franchigia di un provider si azzera — puoi lasciarla lì e tornare più tardi.

Se preferisci non aspettare, apri l'esecuzione nella scheda [Attività](guide:usage-activity) e usa **Riprendi ora con…** per completare le coppie rimaste con un provider a pagamento, oppure **Riprova il pool gratuito** per ritentare subito.

## Livelli di qualità, e migliorare solo ciò che serve

I modelli gratuiti non si equivalgono, perciò ognuno porta un **livello di qualità** da 1 a 4, dove 4 è il più solido. Ogni traduzione registra il livello del modello che l'ha prodotta, e questo trasforma il "tradurre tutto gratis" in una prima passata utilizzabile:

1. Traduci l'intero progetto con Freeway, a costo zero.
2. Nella scheda **Traduzioni**, filtra per **Sotto il livello** per vedere che cosa ha gestito un modello più debole.
3. Seleziona quelle voci e usa **Ritraduci sotto il livello** per rifare solo quelle con un provider migliore.

Alla fine paghi soltanto per le voci che ne avevano davvero bisogno.

## Dove altro funziona Freeway

Freeway non serve solo a tradurre. È disponibile come modulo anche per la **revisione IA**, la **revisione della fonte** e la generazione di **glossari** e **categorie** — in ogni caso sceglie il miglior modello gratuito per il compito e nasconde le impostazioni di modello e sforzo di ragionamento, dato che non c'è nulla da scegliere. Vedi [Revisione IA](guide:usage-ai-review), [Glossario](guide:usage-glossary) e [Categoria](guide:usage-category).
