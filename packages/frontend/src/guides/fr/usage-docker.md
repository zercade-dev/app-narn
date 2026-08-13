# Utilisation de Docker

## Aperçu

L’application est distribuée sous forme d’une image Docker accompagnée d’un `docker-compose.yml` qui démarre **deux services** : `app` (qui sert à la fois l’API et l’interface compilée sur un seul port) et une base de données `postgres` **requise**. Le stockage repose entièrement sur Postgres, donc le serveur ne démarre pas sans elle. Par défaut, `docker compose up` récupère l’image publiée `:main` (`ghcr.io/zercade-dev/narn:main`) depuis GHCR et démarre à ses côtés un Postgres 17 officiel.

## Prérequis

* **Docker** et **Docker Compose** installés.
* L’image de l’application est compilée pour **amd64** uniquement. Sur Apple Silicon, elle fonctionne quand même — Docker l’exécute par émulation.
* Si l’image est privée pour votre compte, exécutez `docker login ghcr.io` une fois (avec un token disposant de `read:packages`) avant le premier téléchargement.

## Lancer l’application

Depuis le dossier contenant `docker-compose.yml` — la racine des sources de NARN :

```
docker compose up
```

Compose démarre d’abord Postgres, attend son bilan de santé, puis démarre l’application. Une fois l’application saine, ouvrez-la sur `http://localhost:3001`.

La pile utilise deux volumes nommés pour que vos données survivent aux redémarrages :

* **`translator-db`** — le répertoire de données Postgres, où vivent vos **projets** et votre **mémoire de traduction**.
* **`translator-data`** — le fichier de coffre local, plus les sauvegardes et instantanés automatiques par projet.

Postgres ne publie aucun port hôte et réside sur un réseau Docker interne, il n’est donc joignable que par le conteneur de l’application.

## Changer le port hôte

Le conteneur écoute toujours sur le port **3001** à l’intérieur de Docker. Le fichier compose le fait correspondre au même port sur votre machine :

```
ports:
  - "127.0.0.1:3001:3001"
```

Si le port 3001 est déjà utilisé, changez le **côté gauche (hôte)** de la correspondance — la partie avant le deuxième deux-points. Par exemple, pour servir l’application sur le port 8000 :

```
ports:
  - "127.0.0.1:8000:3001"
```

L’application est alors joignable sur `http://localhost:8000`.

Ne changez **pas** les variables d’environnement `HOST` ou `PORT` — elles sont internes au conteneur (le serveur se lie à `0.0.0.0:3001` à l’intérieur du conteneur pour que Docker puisse rediriger vers lui). Seul le côté hôte de la correspondance `ports` contrôle l’adresse sur votre machine.

Le préfixe `127.0.0.1:` maintient l’application liée à la boucle locale, préservant sa posture mono-utilisateur et locale uniquement. Laissez-le en place, sauf si vous avez une raison délibérée d’exposer l’application.
