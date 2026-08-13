# Brankas Kredensial

## Ringkasan

Kunci API penyedia tidak pernah disimpan dalam berkas konfigurasi biasa
atau variabel lingkungan. Kunci itu berada di **brankas kredensial** —
simpanan terenkripsi yang harus dibuka kuncinya sebelum penerjemahan atau
tinjauan AI apa pun bisa memakai sebuah kredensial. Anda membuka kuncinya
sekali per sesi peramban; kredensial hanya didekripsi dalam memori.

<!-- local-only -->
## Brankas kata sandi (mandiri)

Pada instalasi mandiri, brankasnya adalah berkas lokal terenkripsi.
Pembukaan kunci pertama membuatnya: kata sandi yang Anda pilih menjadi
kata sandi brankas, dan setiap kredensial yang Anda simpan mengenkripsi
ulang berkasnya. Kata sandinya sendiri tidak pernah disimpan — tanpanya,
berkas itu tidak bisa didekripsi. Buka kuncinya dari **Konfigurasi
Global**, atau dari kartu *Brankas terkunci* mana pun.
<!-- /local-only -->

## Brankas terikat perangkat (cloud)

Pada versi cloud, brankasnya disimpan **terenkripsi di server**, dan
mendekripsinya memerlukan dua faktor:

- **Kata sandi** Anda — tidak pernah disimpan di mana pun, baik di server
  maupun di perangkat.
- **Kunci per perangkat** — dibuat di peramban Anda saat Anda mendaftarkan
  sebuah perangkat dan hanya disimpan di perangkat itu.

Saat Anda membuka kunci, kedua faktor itu dikirim lewat koneksi
terenkripsi dan digabungkan di sisi server untuk menurunkan kunci
dekripsinya **dalam memori, hanya untuk sesi Anda**. Baik faktor itu
maupun kunci turunannya tidak pernah ditulis ke penyimpanan server — yang
tersimpan hanya brankas terenkripsinya sendiri. Jadi data server yang
tersimpan saja tidak bisa mengungkap kredensial Anda, dan kata sandi yang
bocor sendirian pun tidak cukup: membuka kunci juga memerlukan salah satu
perangkat terdaftar Anda.

Jika Konfigurasi Global menampilkan tombol **Buka halaman brankas**
alih-alih permintaan kata sandi, berarti Anda memakai brankas terikat
perangkat — halaman Brankas menangani penyiapan, pendaftaran perangkat,
pembukaan kunci, penyuntingan kredensial, dan perubahan kata sandi.

## Yang perlu diketahui

- Perangkat yang belum pernah Anda pakai harus **didaftarkan** dulu di
  halaman Brankas sebelum bisa membuka kuncinya.
- Jika Anda kehilangan kata sandi (atau, pada cloud, semua perangkat
  terdaftar), isi brankasnya tidak bisa dipulihkan — Anda harus
  menyiapkan brankasnya lagi dan memasukkan ulang kunci penyedia Anda.
- Apa pun yang dicatat aplikasi melewati penyamaran, jadi nilai kredensial
  tidak pernah muncul di log.
