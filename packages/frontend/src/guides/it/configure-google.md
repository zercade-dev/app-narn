# Modulo Google AI (Gemini)

## Panoramica

Il modulo **Google AI** traduce con i modelli Gemini di Google. Richiede una
chiave API di Google AI Studio, conservata nella cassaforte delle
credenziali sotto la chiave `GOOGLE_API_KEY`.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **Google AI (Gemini)**. Quando manca
   una chiave richiesta, l'editor della cassaforte si apre automaticamente
   sulla chiave giusta — altrimenti fai clic su **Gestisci la cassaforte
   delle credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `GOOGLE_API_KEY`, incolla la tua chiave come valore, inserisci la tua
   **password della cassaforte** e fai clic su **Salva**.

Se una scheda mostra in seguito *Cassaforte bloccata*, fai clic su **Sblocca
la cassaforte** prima di tradurre.

## Scegli un modello

Nella scheda **Configurazione** di un progetto, scegli un modello Gemini (ed
eventualmente un livello di ragionamento), oppure lascialo ereditare il
valore predefinito globale. Le **regole di routing** nella scheda Routing
decidono quale modulo gestisce ciascuna lingua. I modelli di ragionamento
segnalano conteggi di token elevati rispetto ai caratteri, quindi le stime
di costo possono sembrare alte.

## Ottieni una chiave API Google

1. Visita [ai.google.dev](https://ai.google.dev) e fai clic su **Get API
   key**, oppure vai direttamente a
   [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Fai clic su **Create API key** e seleziona il tuo progetto.
3. Copia la chiave generata.
4. Incollala nel valore di `GOOGLE_API_KEY` nell'editor della cassaforte.
