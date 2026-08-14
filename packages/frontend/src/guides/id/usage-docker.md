# Pemakaian Docker

## Ringkasan

Aplikasi ini dikirim sebagai image Docker ditambah `docker-compose.yml` yang
menjalankan **dua layanan**: `app` (yang melayani API dan UI yang sudah
dibangun pada satu port yang sama) dan database `postgres` yang
**diwajibkan**. Penyimpanan bersifat Postgres-di-mana-mana, sehingga server
tidak akan bisa dijalankan tanpanya. Secara bawaan `docker compose up`
menarik image `:main` yang dipublikasikan
(`ghcr.io/zercade-dev/narn:main`) dari GHCR dan menjalankan Postgres 17
resmi bersamanya.

## Prasyarat

* **Docker** dan **Docker Compose** terpasang.
* Image aplikasi ini dibangun khusus untuk **amd64**. Di Apple Silicon tetap
  bisa berjalan — Docker menjalankannya melalui emulasi.
* Jika image bersifat privat untuk akun Anda, jalankan `docker login
  ghcr.io` sekali (dengan token yang punya `read:packages`) sebelum
  penarikan pertama.

## Menjalankan

Dari folder yang berisi `docker-compose.yml` — tingkat teratas sumber NARN:

```
docker compose up
```

Compose menjalankan Postgres lebih dulu, menunggu pemeriksaan
kesehatannya, lalu menjalankan aplikasinya. Setelah aplikasi sehat, buka di
`http://localhost:3001`.

Stack ini memakai dua volume bernama sehingga data Anda tetap ada setelah
dimulai ulang:

* **`translator-db`** — direktori data Postgres, tempat **proyek** dan
  **memori terjemahan** Anda berada.
* **`translator-data`** — berkas brankas lokal ditambah cadangan dan
  snapshot otomatis per proyek.

Postgres tidak mempublikasikan port host apa pun dan berada di jaringan
Docker internal, sehingga hanya bisa dijangkau oleh kontainer aplikasi.

## Mengubah port host

Kontainernya selalu mendengarkan pada port **3001** di dalam Docker. Berkas
compose memetakannya ke port yang sama di komputer Anda:

```
ports:
  - "127.0.0.1:3001:3001"
```

Jika port 3001 sudah dipakai, ubah **sisi kiri (host)** pemetaannya —
bagian sebelum titik dua kedua. Misalnya, untuk melayani pada port 8000:

```
ports:
  - "127.0.0.1:8000:3001"
```

Aplikasinya kemudian bisa dijangkau di `http://localhost:8000`.

**Jangan** ubah variabel lingkungan `HOST` atau `PORT` — keduanya bersifat
internal-kontainer (servernya terikat ke `0.0.0.0:3001` di dalam kontainer
agar Docker bisa meneruskannya). Hanya sisi host dari pemetaan `ports` yang
mengatur alamat di komputer Anda.

Awalan `127.0.0.1:` menjaga aplikasi tetap terikat ke loopback, mempertahankan
sifat lokal-saja dan satu-pengguna. Biarkan tetap seperti itu kecuali Anda
punya alasan yang disengaja untuk mengekspos aplikasinya.
