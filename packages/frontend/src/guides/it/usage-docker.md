# Uso di Docker

## Panoramica

L'app viene distribuita come immagine Docker più un `docker-compose.yml`
che avvia **due servizi**: l'`app` (che serve sia l'API sia l'interfaccia
compilata su un'unica porta) e un database `postgres` **obbligatorio**. La
persistenza è basata su Postgres ovunque, quindi il server non si avvia
senza di esso. Per impostazione predefinita `docker compose up` scarica
l'immagine pubblicata `:main` (`ghcr.io/zercade-dev/narn:main`) da GHCR e
avvia accanto a essa un Postgres 17 ufficiale.

## Prerequisiti

- **Docker** e **Docker Compose** installati.
- L'immagine dell'app è compilata solo per **amd64**. Su Apple Silicon
  funziona comunque — Docker la esegue tramite emulazione.
- Se l'immagine è privata per il tuo account, esegui una volta `docker
  login ghcr.io` (con un token che ha `read:packages`) prima del primo
  download.

## Avvio

Dalla cartella che contiene `docker-compose.yml` — il livello superiore dei
sorgenti di NARN:

```
docker compose up
```

Compose avvia prima Postgres, attende il suo healthcheck, poi avvia l'app.
Quando l'app è pronta, aprila su `http://localhost:3001`.

Lo stack usa due volumi denominati, così i tuoi dati sopravvivono ai
riavvii:

- **`translator-db`** — la directory dei dati di Postgres, dove vivono i
  tuoi **progetti** e la **memoria di traduzione**.
- **`translator-data`** — il file della cassaforte locale più i backup per
  progetto e le istantanee automatiche.

Postgres non pubblica alcuna porta host e si trova su una rete Docker
interna, quindi è raggiungibile solo dal container dell'app.

## Cambiare la porta host

Il container ascolta sempre sulla porta **3001** all'interno di Docker. Il
file compose la mappa sulla stessa porta della tua macchina:

```
ports:
  - "127.0.0.1:3001:3001"
```

Se la porta 3001 è già in uso, cambia il lato **sinistro (host)** della
mappatura — la parte prima del secondo due punti. Per esempio, per servire
sulla porta 8000:

```
ports:
  - "127.0.0.1:8000:3001"
```

A quel punto l'app è raggiungibile su `http://localhost:8000`.

**Non** modificare le variabili d'ambiente `HOST` o `PORT` — sono interne
al container (il server si aggancia a `0.0.0.0:3001` all'interno del
container, così Docker può inoltrarvi il traffico). Solo il lato host della
mappatura `ports` controlla l'indirizzo sulla tua macchina.

Il prefisso `127.0.0.1:` mantiene l'app agganciata al loopback, preservando
la sua natura locale e a singolo utente. Lascialo invariato a meno che tu
non abbia un motivo deliberato per esporre l'app.
