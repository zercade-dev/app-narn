# Modulo Generic AI

## Panoramica

Il modulo **Generic AI** si collega a qualsiasi API compatibile con OpenAI —
un provider ospitato o un server eseguito in locale (ad es. Ollama, LM
Studio, vLLM). La sua chiave è conservata nella cassaforte delle credenziali
sotto `GENERIC_API_KEY`.

**La chiave API è facoltativa.** Conta solo per gli endpoint che richiedono
l'autenticazione (la maggior parte dei provider cloud a pagamento). Un
server locale come Ollama o LM Studio non richiede una chiave reale — ma la
cassaforte richiede comunque che il campo `GENERIC_API_KEY` non sia vuoto,
quindi salva un valore segnaposto qualsiasi (ad es. `local`) per
soddisfarla.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **Generic AI**. Quando manca una
   chiave richiesta, l'editor della cassaforte si apre automaticamente sulla
   chiave giusta — altrimenti fai clic su **Gestisci la cassaforte delle
   credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `GENERIC_API_KEY`, inserisci la tua **password della cassaforte** e fai
   clic su **Salva**. Per un endpoint a pagamento, incolla la chiave API
   reale come valore. Per un server locale che non richiede
   autenticazione, la chiave è facoltativa — basta salvare un segnaposto
   non vuoto qualsiasi (ad es. `local`).

## Usa più endpoint con le istanze

Generic AI supporta le **istanze denominate**, quindi puoi registrare più
endpoint (per esempio un provider cloud e un server locale) fianco a fianco.
Usa **Aggiungi un'altra istanza di Generic AI** in Configurazione globale.
Ogni istanza riceve una propria chiave della cassaforte derivata — per
esempio `GENERIC_API_KEY__MY-OLLAMA` — che compili nello stesso editor della
cassaforte.

## Scegli endpoint e modello

Imposta l'URL di base e il modello per il modulo (o per ogni istanza) nelle
sue impostazioni di Configurazione globale, poi scegli il modello per
singolo progetto nella scheda **Configurazione**. Le **regole di routing**
nella scheda Routing decidono quale modulo o istanza gestisce ciascuna
lingua.

## Ottieni le credenziali

Per un **server locale** (Ollama, LM Studio, vLLM), non serve alcun account
o chiave — solo l'URL di base (ad es. `http://localhost:11434/v1`) e un
segnaposto nel campo `GENERIC_API_KEY`.

Per un **provider a pagamento**, i passaggi dipendono dal provider: crea un
account, ottieni l'URL di base dell'API e la chiave, e verifica che
l'endpoint parli il formato chat-completions di OpenAI prima di inserire la
chiave nella cassaforte.
