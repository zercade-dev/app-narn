# NARN Freeway

## Ikhtisar

**NARN Freeway** adalah kumpulan bersama model AI tingkat gratis yang aplikasi salurkan pekerjaannya secara otomatis — tanpa perlu kartu kredit. Kunci penyedia tetap Anda yang menyediakan; yang ditambahkan Freeway adalah pembukuannya. Ia melacak sisa kuota gratis tiap penyedia, memilih model untuk setiap batch, dan berpindah ke yang lain ketika sebuah model terkena batas laju atau habis untuk hari itu.

Arahkan penyaluran ke Freeway dan Anda tidak perlu memilih model lagi: pekerjaan Freeway tidak punya setelan model maupun upaya penalaran, sebab pilihannya dibuat per batch, per bahasa, dari apa pun yang bisa dilayani kumpulan itu saat itu juga.

## Cara mengaktifkan

Proyek yang benar-benar baru dan belum punya aturan penyaluran menampilkan tombol **Serahkan semuanya ke NARN Freeway** di tab [Penyaluran](guide:usage-routing) — satu klik membuat aturan menyeluruh yang menunjuk ke kumpulan gratis itu.

Selain itu, pilih **NARN Freeway** seperti penyedia lainnya: di pemilih sederhana tab Penyaluran untuk mengirim seluruh proyek ke sana, atau sebagai modul pada satu aturan di **Lanjutan** untuk memakainya pada sebagian bahasa dan penyedia berbayar pada sisanya.

Dua hal harus siap lebih dulu: setidaknya satu penyedia gratis punya kunci tersimpan di [brankas kredensial](guide:usage-vault), dan brankasnya terbuka — selama terkunci, setiap penyedia Freeway tampak seperti tidak punya kunci.

## Penyedia mana yang dipakai

Freeway memanfaatkan tingkat gratis penyedia yang sudah Anda konfigurasikan sebagai modul. Saat ini ia tahu cara memakai:

* **Google AI (Gemini)** — jatah gratis terbesar, dan sumber sebagian besar model terkuat di kumpulan ini.
* **Groq** — cepat, dengan jumlah permintaan harian yang longgar.
* **OpenRouter** — model-model gratis yang ditampungnya.
* **DeepL** — jatah karakter bulanan paket gratisnya, untuk terjemahan mesin klasik.

<!-- local-only -->

* **GitHub Copilot** — kalau Anda punya langganan Copilot.

<!-- /local-only -->

Penyedia yang belum Anda beri kunci cukup dilewati. Menambah satu kunci lagi memperluas kumpulan dan memperkecil kemungkinan sebuah proses harus menunggu.

## Memantau kumpulan

Panel **NARN Freeway** di layar konfigurasi menampilkan seluruh kumpulan sekilas: status kunci tiap penyedia, dan untuk tiap model **Status**-nya, **Sisa** kuota, **Reset berikutnya**, serta **Tingkat lulus** terkini per bahasa.

Status sebuah model adalah salah satu dari:

* **Siap** — bisa dipakai sekarang.
* **Mendingin** — sebentar terkena batas laju; ia pulih sendiri.
* **Habis untuk hari ini** — jatah harian sudah terpakai, dan panel menunjukkan kapan ia direset.
* **Modul dinonaktifkan** — kuncinya tersimpan tetapi modulnya dimatikan. Panel menawarkan untuk mengaktifkannya.
* **Tidak ada kunci** — belum ada apa pun di brankas untuk penyedia ini.
* **Kredensial tidak valid** — kuncinya ditolak. Tulis kunci yang berfungsi ke brankas untuk menghapus tandanya.

## Ketika kuota gratis habis

Proses yang menghabiskan kumpulan itu tidak gagal. Ia berpindah ke **Menunggu kuota gratis**, menyimpan pasangan yang belum dikerjakan, dan melanjut sendiri begitu jatah salah satu penyedia direset — Anda bisa meninggalkannya lalu kembali nanti.

Kalau Anda tidak mau menunggu, buka prosesnya di tab [Aktivitas](guide:usage-activity) lalu gunakan **Lanjutkan sekarang dengan…** untuk menyelesaikan sisa pasangan dengan penyedia berbayar, atau **Coba ulang kumpulan gratis** untuk mencoba kumpulan itu lagi seketika.

## Tingkat kualitas, dan menaikkan hanya yang perlu

Model gratis tidak sama baiknya, jadi masing-masing membawa **tingkat kualitas** dari 1 sampai 4 — 4 yang terkuat. Setiap terjemahan mencatat tingkat model yang menghasilkannya, sehingga “terjemahkan semuanya gratis” menjadi langkah pertama yang berguna:

1. Terjemahkan seluruh proyek lewat Freeway tanpa biaya.
2. Di tab **Terjemahan**, saring dengan **Di bawah tingkat** untuk melihat apa yang ditangani model yang lebih lemah.
3. Pilih entri-entri itu lalu gunakan **Terjemahkan ulang di bawah tingkat** untuk mengulang hanya bagian itu dengan penyedia yang lebih baik.

Pada akhirnya Anda hanya membayar entri yang memang membutuhkannya.

## Di mana lagi Freeway bekerja

Freeway bukan hanya untuk terjemahan. Ia juga tersedia sebagai modul untuk **tinjauan AI**, **tinjauan sumber**, serta pembuatan **glosarium** dan **kategori** — pada tiap kasus ia memilih model gratis terbaik untuk tugas itu dan menyembunyikan setelan model dan upaya penalaran, sebab tidak ada yang perlu dipilih. Lihat [Tinjauan AI](guide:usage-ai-review), [Glosarium](guide:usage-glossary), dan [Kategori](guide:usage-category).
