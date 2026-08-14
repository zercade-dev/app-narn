# Memori Terjemahan

## Ringkasan

**Memori Terjemahan** (TM) adalah simpanan terjemahan yang sudah dikenal,
mencakup seluruh ruang kerja. Ketika teks sumber sebuah entri cocok dengan
yang sudah ada di memori, terjemahan tersimpannya dipakai ulang secara
otomatis alih-alih memanggil modul berbayar — menghemat waktu dan biaya
serta menjaga teks yang identik tetap konsisten di seluruh proyek. Buka
tampilan **Memori Terjemahan** dari bilah sisi untuk menelusuri dan
mencari segmen tersimpan.

> **Memori Terjemahan nonaktif secara bawaan** untuk setiap proyek. Selama
> nonaktif, tidak ada yang diterjemahkan sebuah proyek ditulis ke memori
> dan tidak ada terjemahan tersimpan yang diterapkan otomatis. Untuk
> mengaktifkannya, buka tab **Konfigurasi** proyek dan pilih kebijakan
> pemakaian ulang di bagian **Memori Terjemahan** (nilai apa pun selain
> *Nonaktif*).

## Bagaimana entri masuk ke memori

* **Setujui ke memori** — di tab **Terjemahan**, pilih terjemahan lalu
  setujui; terjemahan itu dicatat sebagai segmen terpercaya.
* Terjemahan yang selesai juga dicatat sehingga teks sumber yang identik
  bisa memakainya ulang nanti.

## Kebijakan pemakaian ulang

Kebijakan pemakaian ulang (di tab **Konfigurasi** proyek, bagian **Memori
Terjemahan**) mengatur *apakah* dan *kapan* terjemahan tersimpan dipakai
ulang untuk teks sumber yang identik. Bawaannya **Nonaktif** (TM mati);
pilihan lain — misalnya **Ketat (konteks harus cocok penuh)**, yang hanya
memakai ulang saat konteks sekitarnya juga cocok — mengaktifkannya.
Memperketat kebijakan menghindari pemakaian ulang terjemahan yang benar di
satu tempat tetapi tidak di tempat lain.

## Mengendalikan pemakaian ulang per putaran

Saat Anda memulai penerjemahan dari dialog *Terjemahkan…* pada tab
**Bandingkan**, sebuah pemberitahuan memberi tahu berapa banyak entri yang
akan diisi dari memori, dan Anda bisa **nonaktifkan memori untuk putaran
ini** untuk memaksa setiap entri diterjemahkan baru seluruhnya — berguna
saat Anda ingin model mempertimbangkan ulang teks yang sudah pernah
diingat sebelumnya.
