# Docker Usage

## Overview

The app ships as a Docker image plus a `docker-compose.yml` that brings up **two services**: the `app` (which serves both the API and the built UI on one port) and a **required** `postgres` database. Storage is Postgres-everywhere, so the server will not boot without it. By default `docker compose up` pulls the published `:main` image (`ghcr.io/zercade-dev/narn:main`) from GHCR and starts an official Postgres 17 alongside it.

## Prerequisites

* **Docker** and **Docker Compose** installed.
* The app image is built for **amd64** only. On Apple Silicon it still runs — Docker executes it via emulation.
* If the image is private for your account, run `docker login ghcr.io` once (with a token that has `read:packages`) before the first pull.

## Running

From the folder that contains `docker-compose.yml` — the top level of the NARN source:

```
docker compose up
```

Compose starts Postgres first, waits for its healthcheck, then starts the app. Once the app is healthy, open it at `http://localhost:3001`.

The stack uses two named volumes so your data survives restarts:

* **`translator-db`** — the Postgres data directory, where your **projects** and **translation memory** live.
* **`translator-data`** — the local vault file plus per-project backups and auto-snapshots.

Postgres publishes no host port and sits on an internal Docker network, so it is reachable only by the app container.

## Changing the host port

The container always listens on port **3001** inside Docker. The compose file maps it to the same port on your machine:

```
ports:
  - "127.0.0.1:3001:3001"
```

If port 3001 is already in use, change the **left (host) side** of the mapping — the part before the second colon. For example, to serve on port 8000:

```
ports:
  - "127.0.0.1:8000:3001"
```

Then the app is reachable at `http://localhost:8000`.

Do **not** change the `HOST` or `PORT` environment variables — those are container-internal (the server binds `0.0.0.0:3001` inside the container so Docker can forward to it). Only the host side of the `ports` mapping controls the address on your machine.

The `127.0.0.1:` prefix keeps the app bound to loopback, preserving the single-user, local-only posture. Leave it in place unless you have a deliberate reason to expose the app.
