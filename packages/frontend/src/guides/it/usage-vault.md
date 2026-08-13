# Cassaforte delle credenziali

## Panoramica

Le chiavi API dei provider non vengono mai conservate in file di
configurazione in chiaro o in variabili d'ambiente. Vivono nella
**cassaforte delle credenziali** — un archivio cifrato che deve essere
sbloccato prima che qualsiasi traduzione o revisione IA possa usare una
credenziale. La sblocchi una volta per sessione del browser; le credenziali
vengono decifrate solo in memoria.

<!-- local-only -->
## Cassaforte con password (self-hosted)

Su un'installazione self-hosted la cassaforte è un file locale cifrato. Il
primo sblocco la crea: la password che scegli diventa la password della
cassaforte, e ogni credenziale che salvi ricifra il file. La password non
viene mai conservata: senza di essa, il file non può essere decifrato.
Sblocca da **Configurazione globale**, oppure da qualsiasi scheda *Cassaforte
bloccata*.
<!-- /local-only -->

## Cassaforte legata al dispositivo (cloud)

Sulla versione cloud la cassaforte è conservata **cifrata sul server**, e
decifrarla richiede due fattori:

- La tua **password** — mai conservata da nessuna parte, né sul server né
  sul dispositivo.
- Una **chiave per dispositivo** — generata nel tuo browser quando iscrivi
  un dispositivo e conservata solo su quel dispositivo.

Quando sblocchi, entrambi i fattori viaggiano sulla connessione cifrata e
vengono combinati lato server per derivare la chiave di decifrazione **in
memoria, solo per la tua sessione**. Né i fattori né la chiave derivata
vengono mai scritti nell'archivio del server — ciò che è conservato è solo
la cassaforte cifrata stessa. Quindi i dati salvati sul server da soli non
possono rivelare le tue credenziali, e nemmeno una password trapelata da
sola basta: lo sblocco richiede anche uno dei tuoi dispositivi iscritti.

Se Configurazione globale mostra un pulsante **Vai alla pagina della
cassaforte** invece di una richiesta di password, ti trovi sulla cassaforte
legata al dispositivo — la pagina della cassaforte gestisce la
configurazione, l'iscrizione dei dispositivi, lo sblocco, la modifica delle
credenziali e il cambio della password.

## Cose utili da sapere

- Un dispositivo mai usato prima deve essere **iscritto** nella pagina
  della cassaforte prima di poterla sbloccare.
- Se perdi la password (oppure, sul cloud, ogni dispositivo iscritto), il
  contenuto della cassaforte non può essere recuperato — dovrai
  configurarla di nuovo e reinserire le chiavi dei tuoi provider.
- Tutto ciò che l'app registra nei log passa attraverso la redazione, così
  i valori delle credenziali non compaiono mai nei log.
