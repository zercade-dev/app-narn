# Modulo OpenAI (GPT)

## Panoramica

Il modulo **GPT** traduce con i modelli di OpenAI. Richiede una chiave API
OpenAI, conservata nella cassaforte delle credenziali sotto la chiave
`OPENAI_API_KEY`.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **OpenAI (GPT)**. Quando manca una
   chiave richiesta, l'editor della cassaforte si apre automaticamente sulla
   chiave giusta — altrimenti fai clic su **Gestisci la cassaforte delle
   credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `OPENAI_API_KEY`, incolla la tua chiave come valore, inserisci la tua
   **password della cassaforte** e fai clic su **Salva**.

Se una scheda mostra in seguito *Cassaforte bloccata*, fai clic su **Sblocca
la cassaforte** prima di tradurre.

## Scegli un modello

Nella scheda **Configurazione** di un progetto, scegli un modello GPT (ed
eventualmente un livello di ragionamento), oppure lascialo ereditare il
valore predefinito globale. Le **regole di routing** nella scheda Routing
decidono quale modulo gestisce ciascuna lingua.

## Ottieni una chiave API OpenAI

1. Visita
   [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).
2. Registrati o accedi.
3. Fai clic su **Create new secret key**.
4. Copia la chiave (viene mostrata una sola volta).
5. Incollala nel valore di `OPENAI_API_KEY` nell'editor della cassaforte.
