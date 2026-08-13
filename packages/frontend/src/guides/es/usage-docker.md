# Uso de Docker

## Descripción general

La aplicación se distribuye como una imagen Docker más un `docker-compose.yml` que levanta **dos servicios**: `app` (que sirve tanto la API como la interfaz compilada en un solo puerto) y una base de datos `postgres` **obligatoria**. El almacenamiento es Postgres en todas partes, así que el servidor no arrancará sin él. Por defecto, `docker compose up` descarga la imagen publicada `:main` (`ghcr.io/zercade-dev/narn:main`) desde GHCR e inicia junto a ella un Postgres 17 oficial.

## Requisitos previos

* **Docker** y **Docker Compose** instalados.
* La imagen de la aplicación está compilada solo para **amd64**. En Apple Silicon igualmente funciona — Docker la ejecuta mediante emulación.
* Si la imagen es privada para tu cuenta, ejecuta `docker login ghcr.io` una vez (con un token que tenga `read:packages`) antes de la primera descarga.

## Ejecución

Desde la carpeta que contiene `docker-compose.yml` — la raíz del código fuente de NARN:

```
docker compose up
```

Compose arranca primero Postgres, espera a su comprobación de estado y luego arranca la aplicación. Cuando la aplicación esté lista, ábrela en `http://localhost:3001`.

El stack usa dos volúmenes con nombre para que tus datos sobrevivan a los reinicios:

* **`translator-db`** — el directorio de datos de Postgres, donde viven tus **proyectos** y la **memoria de traducción**.
* **`translator-data`** — el archivo local de la bóveda, más las copias de seguridad por proyecto y las instantáneas automáticas.

Postgres no publica ningún puerto del host y queda en una red interna de Docker, así que solo el contenedor de la aplicación puede alcanzarlo.

## Cambiar el puerto del host

El contenedor siempre escucha en el puerto **3001** dentro de Docker. El archivo compose lo asigna al mismo puerto en tu máquina:

```
ports:
  - "127.0.0.1:3001:3001"
```

Si el puerto 3001 ya está en uso, cambia el lado **izquierdo (host)** de la asignación — la parte antes de los segundos dos puntos. Por ejemplo, para servir en el puerto 8000:

```
ports:
  - "127.0.0.1:8000:3001"
```

Entonces la aplicación estará disponible en `http://localhost:8000`.

**No** cambies las variables de entorno `HOST` ni `PORT` — son internas del contenedor (el servidor se enlaza a `0.0.0.0:3001` dentro del contenedor para que Docker pueda reenviar el tráfico). Solo el lado del host de la asignación `ports` controla la dirección en tu máquina.

El prefijo `127.0.0.1:` mantiene la aplicación enlazada a loopback, preservando su posición de uso local y de un solo usuario. Déjalo tal cual a menos que tengas una razón deliberada para exponer la aplicación.
