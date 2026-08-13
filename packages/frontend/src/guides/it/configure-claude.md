# Modulo Anthropic (Claude)

## Panoramica

Il modulo **Claude** traduce con i modelli Claude di Anthropic. Richiede una
chiave API Anthropic, conservata nella cassaforte delle credenziali sotto la
chiave `ANTHROPIC_API_KEY`.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **Anthropic (Claude)**. Quando manca
   una chiave richiesta, l'editor della cassaforte si apre automaticamente
   sulla chiave giusta — altrimenti fai clic su **Gestisci la cassaforte
   delle credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `ANTHROPIC_API_KEY`, incolla la tua chiave come valore, inserisci la tua
   **password della cassaforte** e fai clic su **Salva**. Il salvataggio
   ricifra la cassaforte.

Se una scheda mostra in seguito *Cassaforte bloccata*, fai clic su **Sblocca
la cassaforte** prima di tradurre.

## Scegli un modello

Nella scheda **Configurazione** di un progetto, scegli un modello Claude (ed
eventualmente un livello di ragionamento), oppure lascia che erediti il
valore predefinito globale. Le **regole di routing** nella scheda Routing
decidono quale modulo gestisce ciascuna lingua.

## Ottieni una chiave API Anthropic

1. Visita [console.anthropic.com](https://console.anthropic.com).
2. Registrati o accedi.
3. Apri la sezione **API keys**.
4. Fai clic su **Create Key** e copiala.
5. Incollala nel valore di `ANTHROPIC_API_KEY` nell'editor della cassaforte.
