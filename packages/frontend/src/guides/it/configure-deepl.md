# Modulo DeepL

## Panoramica

Il modulo **DeepL** fornisce traduzione automatica neurale professionale. A
differenza dei moduli basati su LLM è una MT classica, e può inviare i
glossari di progetto a DeepL per una terminologia coerente. La sua chiave è
conservata nella cassaforte delle credenziali sotto `DEEPL_API_KEY`.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **DeepL**. Quando manca una chiave
   richiesta, l'editor della cassaforte si apre automaticamente sulla chiave
   giusta — altrimenti fai clic su **Gestisci la cassaforte delle
   credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `DEEPL_API_KEY`, incolla la tua chiave di autenticazione come valore,
   inserisci la tua **password della cassaforte** e fai clic su **Salva**.

DeepL non supporta istanze denominate — esiste un unico modulo DeepL.

## Uso dei glossari

DeepL può applicare un glossario durante la traduzione. Costruisci i termini
nella scheda **Glossario**, poi usa **Invia a DeepL** per caricarli. Se un
glossario cambia dopo un invio, la scheda mostra *Nuovo invio necessario* —
invia di nuovo per aggiornare DeepL.

## Ottieni una chiave API DeepL

1. Visita [deepl.com/account](https://www.deepl.com/account).
2. Registrati per un account API Free o Pro.
3. Apri **Account Settings** e trova la sezione **API Key**.
4. Copia la tua chiave di autenticazione.
5. Incollala nel valore di `DEEPL_API_KEY` nell'editor della cassaforte.
