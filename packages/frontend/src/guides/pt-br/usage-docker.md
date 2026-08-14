# Uso com Docker

## Visão geral

O app é distribuído como uma imagem Docker, mais um `docker-compose.yml` que
sobe **dois serviços**: o `app` (que serve tanto a API quanto a interface já
compilada em uma única porta) e um banco `postgres` **obrigatório**. O
armazenamento é Postgres em toda parte, então o servidor não inicia sem ele.
Por padrão, `docker compose up` baixa a imagem publicada `:main`
(`ghcr.io/zercade-dev/narn:main`) do GHCR e inicia um Postgres 17 oficial
junto com ela.

## Pré-requisitos

- **Docker** e **Docker Compose** instalados.
- A imagem do app é compilada apenas para **amd64**. Em Apple Silicon ela
  ainda funciona — o Docker a executa por emulação.
- Se a imagem for privada para a sua conta, rode `docker login ghcr.io` uma
  vez (com um token que tenha `read:packages`) antes do primeiro download.

## Rodando

A partir da pasta que contém o `docker-compose.yml` — o nível superior do
código-fonte do NARN:

```
docker compose up
```

O Compose inicia o Postgres primeiro, aguarda a checagem de saúde
(healthcheck) dele e só então inicia o app. Assim que o app estiver saudável,
abra-o em `http://localhost:3001`.

A stack usa dois volumes nomeados para que seus dados sobrevivam a
reinicializações:

- **`translator-db`** — o diretório de dados do Postgres, onde seus
  **projetos** e a **memória de tradução** vivem.
- **`translator-data`** — o arquivo local do cofre, além dos backups por
  projeto e dos instantâneos automáticos.

O Postgres não publica nenhuma porta no host e fica em uma rede Docker
interna, então só é acessível pelo contêiner do app.

## Alterando a porta do host

O contêiner sempre escuta na porta **3001** dentro do Docker. O arquivo
compose mapeia isso para a mesma porta na sua máquina:

```
ports:
  - "127.0.0.1:3001:3001"
```

Se a porta 3001 já estiver em uso, altere o **lado esquerdo (host)** do
mapeamento — a parte antes dos dois-pontos do meio. Por exemplo, para servir
na porta 8000:

```
ports:
  - "127.0.0.1:8000:3001"
```

Então o app fica acessível em `http://localhost:8000`.

**Não** altere as variáveis de ambiente `HOST` ou `PORT` — elas são internas
ao contêiner (o servidor se vincula a `0.0.0.0:3001` dentro do contêiner para
que o Docker consiga encaminhar até ele). Só o lado do host no mapeamento de
`ports` controla o endereço na sua máquina.

O prefixo `127.0.0.1:` mantém o app vinculado ao loopback, preservando a
postura de uso único e local. Deixe-o no lugar, a menos que você tenha um
motivo deliberado para expor o app.
