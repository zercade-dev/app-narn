# Modulo OpenRouter

## Panoramica

Il modulo **OpenRouter** traduce con [OpenRouter](https://openrouter.ai) —
un'unica API che instrada verso i modelli di molti fornitori (Anthropic,
OpenAI, Google, Meta e altri). Richiede una chiave API OpenRouter,
conservata nella cassaforte delle credenziali sotto la chiave
`OPENROUTER_API_KEY`.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **OpenRouter**. Quando manca una
   chiave richiesta, l'editor della cassaforte si apre automaticamente sulla
   chiave giusta — altrimenti fai clic su **Gestisci la cassaforte delle
   credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `OPENROUTER_API_KEY`, incolla la tua chiave come valore, inserisci la tua
   **password della cassaforte** e fai clic su **Salva**.

Se una scheda mostra in seguito *Cassaforte bloccata*, fai clic su **Sblocca
la cassaforte** prima di tradurre.

## Scegli un modello

Nella scheda **Configurazione** di un progetto, scegli un modello dal
catalogo OpenRouter aggiornato in tempo reale — ogni voce mostra il proprio
prezzo per token e la lunghezza del contesto, e sono elencati solo i modelli
di generazione testuale. Gli id dei modelli hanno un prefisso per fornitore
(per esempio `anthropic/claude-sonnet-4.5` oppure
`openai/gpt-4o-mini`); puoi anche digitare direttamente un nuovo slug. Le
**regole di routing** nella scheda Routing decidono quale modulo gestisce
ciascuna lingua.

## Ottieni una chiave API OpenRouter

1. Visita [openrouter.ai](https://openrouter.ai).
2. Registrati o accedi.
3. Apri **Keys** dal menu del tuo account.
4. Crea una nuova chiave API e copiala.
5. Incollala nel valore di `OPENROUTER_API_KEY` nell'editor della
   cassaforte.

Nota: il tuo testo viene inviato a OpenRouter e instradato al fornitore del
modello che scegli, secondo i termini di OpenRouter e le norme sui dati di
quel fornitore.
