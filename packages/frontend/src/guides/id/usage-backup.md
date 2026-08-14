# Tab Cadangan

## Ringkasan

Tab **Cadangan** mengemas sebuah proyek — konfigurasi, entri, dan
glosariumnya — menjadi arsip `.zip` yang dapat diverifikasi. Setiap berkas
diberi checksum, dan checksum-nya diverifikasi sebelum apa pun ditulis
kembali saat dipulihkan.

## Membuat cadangan

1. Pilih sebuah proyek.
2. Buka tab **Cadangan**.
3. Klik **Buat cadangan**.
4. Arsip baru muncul di **Cadangan tersimpan**, tempat Anda bisa
   **Unduh**.

## Cadangan otomatis

Aplikasi ini juga mengambil snapshot pengaman untuk Anda, terdaftar
bersama cadangan manual:

* **Sebelum impor CSV** — titik pemulihan tepat sebelum impornya.
* **Sebelum penerjemahan ulang** — titik pemulihan tepat sebelum entri
  ditimpa.

Konfigurasi Global mengatur **Maksimum cadangan per proyek** (bawaan 10);
cadangan yang lebih lama dari itu dipangkas.

## Memulihkan

1. Di **Pemulihan dari cadangan**, pilih sebuah `.zip` (atau pilih salah
   satu cadangan tersimpan).
2. Aplikasi memverifikasi checksum dan menampilkan pratinjau (proyek,
   berkas, waktu pembuatan).
3. Konfirmasi. Memulihkan menimpa konfigurasi, entri, dan glosarium proyek
   saat ini — tindakan ini tidak dapat diurungkan, jadi buat cadangan baru
   dulu jika ragu.

## Menghapus

Gunakan **Hapus** pada cadangan tersimpan mana pun untuk menghapus arsip
itu dari server secara permanen.
