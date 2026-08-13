# Docker-Nutzung

## Übersicht

Die App wird als Docker-Image plus einer `docker-compose.yml` ausgeliefert, die **zwei Dienste** startet: die `app` (die API und die gebaute Oberfläche über einen einzigen Port ausliefert) und eine **erforderliche** `postgres`-Datenbank. Die Speicherung erfolgt durchgehend über Postgres, daher startet der Server ohne sie nicht. Standardmäßig lädt `docker compose up` das veröffentlichte `:main`-Image (`ghcr.io/zercade-dev/narn:main`) von GHCR und startet daneben ein offizielles Postgres 17.

## Voraussetzungen

* **Docker** und **Docker Compose** installiert.
* Das App-Image ist nur für **amd64** gebaut. Auf Apple Silicon läuft es trotzdem — Docker führt es per Emulation aus.
* Ist das Image für das eigene Konto privat, einmal `docker login ghcr.io` ausführen (mit einem Token mit `read:packages`), bevor der erste Pull erfolgt.

## Ausführen

Im Ordner, der `docker-compose.yml` enthält — die oberste Ebene der NARN-Quellen:

```
docker compose up
```

Compose startet zuerst Postgres, wartet auf dessen Healthcheck und startet dann die App. Sobald die App bereit ist, unter `http://localhost:3001` öffnen.

Der Stack verwendet zwei benannte Volumes, damit die Daten Neustarts überstehen:

* **`translator-db`** — das Postgres-Datenverzeichnis, in dem die eigenen **Projekte** und das **Translation Memory** liegen.
* **`translator-data`** — die lokale Tresor-Datei sowie projektbezogene Backups und Auto-Snapshots.

Postgres veröffentlicht keinen Host-Port und sitzt in einem internen Docker-Netzwerk, ist also nur für den App-Container erreichbar.

## Den Host-Port ändern

Der Container lauscht innerhalb von Docker immer auf Port **3001**. Die Compose-Datei bildet ihn auf denselben Port auf dem eigenen Rechner ab:

```
ports:
  - "127.0.0.1:3001:3001"
```

Ist Port 3001 bereits belegt, die **linke (Host-)Seite** der Zuordnung ändern — den Teil vor dem zweiten Doppelpunkt. Um zum Beispiel auf Port 8000 auszuliefern:

```
ports:
  - "127.0.0.1:8000:3001"
```

Danach ist die App unter `http://localhost:8000` erreichbar.

Die Umgebungsvariablen `HOST` und `PORT` **nicht** ändern — die sind container-intern (der Server bindet innerhalb des Containers an `0.0.0.0:3001`, damit Docker dorthin weiterleiten kann). Nur die Host-Seite der `ports`-Zuordnung bestimmt die Adresse auf dem eigenen Rechner.

Das Präfix `127.0.0.1:` hält die App an Loopback gebunden und bewahrt damit die lokale Single-User-Ausrichtung. So belassen, sofern es keinen bewussten Grund gibt, die App nach außen zugänglich zu machen.
