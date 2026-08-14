# Modulo Groq

## Panoramica

Il modulo **Groq** traduce con [Groq](https://groq.com) — inferenza veloce per
modelli aperti come Llama, Qwen e GPT-OSS, con un livello gratuito adatto al
lavoro di traduzione quotidiano. Richiede una chiave API Groq, conservata
nella cassaforte delle credenziali sotto la chiave `GROQ_API_KEY`.

## Aggiungi la tua chiave alla cassaforte delle credenziali

Le credenziali dei provider risiedono in una **cassaforte delle credenziali**
cifrata, non in una configurazione in chiaro. Sblocchi la cassaforte una
volta per sessione con una password.

1. Apri **Configurazione globale** dalla barra laterale.
2. Se non hai ancora configurato la cassaforte, creala: scegli una password
   della cassaforte (la riuserai a ogni sessione) e sbloccala.
3. In **Attiva un modulo**, seleziona **Groq**. Quando manca una
   chiave richiesta, l'editor della cassaforte si apre automaticamente sulla
   chiave giusta — altrimenti fai clic su **Gestisci la cassaforte delle
   credenziali**.
4. Nell'editor della cassaforte, aggiungi una credenziale: scegli la chiave
   `GROQ_API_KEY`, incolla la tua chiave come valore, inserisci la tua
   **password della cassaforte** e fai clic su **Salva**.

Se una scheda mostra in seguito *Cassaforte bloccata*, fai clic su **Sblocca
la cassaforte** prima di tradurre.

## Scegli un modello

Nella scheda **Configurazione** di un progetto, scegli un modello dal
catalogo Groq aggiornato in tempo reale, oppure eredita il valore predefinito
globale. `llama-3.3-70b-versatile` è una buona scelta predefinita per la
qualità della traduzione; modelli più piccoli come `llama-3.1-8b-instant`
sacrificano un po' di qualità in cambio di velocità. Le **regole di routing**
nella scheda Routing decidono quale modulo gestisce ciascuna lingua.

## Ottieni una chiave API Groq

1. Visita [console.groq.com](https://console.groq.com).
2. Registrati o accedi.
3. Apri **API Keys** dal menu della console.
4. Crea una nuova chiave API e copiala — inizia con `gsk_`.
5. Incollala nel valore di `GROQ_API_KEY` nell'editor della cassaforte.

Il livello gratuito di Groq applica limiti giornalieri per modello (qui
nessun numero fisso — controlla la tua console per i limiti attuali) e,
secondo i termini di Groq, i dati delle API non vengono usati per addestrare
i modelli. Una volta aggiunta la chiave, **NARN Freeway** include
automaticamente il piano gratuito di Groq quando distribuisce il lavoro di
traduzione tra le quote gratuite dei provider connessi — senza
configurazione aggiuntiva.
