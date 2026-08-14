# Modulo GitHub Copilot

## Panoramica

Il modulo **Copilot** traduce tramite GitHub Copilot. Si autentica con un
token GitHub proveniente da un account con un **abbonamento Copilot
attivo**, conservato nella cassaforte delle credenziali sotto la chiave
`GITHUB_TOKEN`.

## Aggiungi il tuo token alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **GitHub Copilot**. Quando manca una
   chiave richiesta, l'editor della cassaforte si apre automaticamente sulla
   chiave giusta — altrimenti fai clic su **Gestisci la cassaforte delle
   credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `GITHUB_TOKEN`, incolla il tuo token come valore, inserisci la tua
   **password della cassaforte** e fai clic su **Salva**.

Se l'elenco dei modelli mostra *Nessun modello disponibile*, il token manca,
non è valido oppure la cassaforte è bloccata — sblocca la cassaforte o
controlla il tuo token GitHub, poi riapri la scheda.

## Ottieni un token GitHub

Usa un token di accesso personale **a grana fine**, così concede solo
l'accesso a Copilot e nient'altro.

1. Visita [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Fai clic su **Generate new token** (i token a grana fine sono
   l'impostazione predefinita).
3. Assegnagli un nome (ad es. “Translator-Copilot”) e imposta una
   **Expiration**.
4. In **Permissions → Account permissions**, trova **Copilot Requests** e
   impostalo su **Read-only**. Non servono altri permessi.
5. Fai clic su **Generate token** e copialo subito — GitHub lo mostra una
   sola volta.
6. Incollalo nel valore di `GITHUB_TOKEN` nell'editor della cassaforte.

L'account dietro il token deve avere un abbonamento Copilot attivo perché le
traduzioni vadano a buon fine.
