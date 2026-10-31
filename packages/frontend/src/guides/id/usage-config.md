# Tab Konfigurasi

## Ringkasan

Tab **Konfigurasi** menyimpan kebijakan penerjemahan untuk proyek yang
dipilih: pilihan model per modul, pemakaian ulang memori terjemahan,
pengelompokan batch, pemeriksaan kualitas (LQA), dan pengelolaan proyek.
**Bahasa** dan **impor/ekspor CSV**-nya kini berada di tab **Data** yang
terpisah. Kredensial penyedia tidak diatur di sini — kredensial itu berada
di **brankas kredensial** (lihat panduan *Konfigurasi Modul* dan
**Konfigurasi Global**).

## Bahasa (di tab Data)

Atur **bahasa sumber** dan **bahasa target** yang akan diterjemahkan di tab
**Data**. Kumpulan target yang aktif menggerakkan setiap tab lainnya —
kolom entri, aturan penyaluran, dan pemeriksaan kualitas semuanya mengikuti
kumpulan itu.

## Impor dan ekspor CSV (di tab Data)

Impor dan ekspor CSV juga berada di tab **Data**:

* **Impor CSV** memuat entri sumber dan terjemahan yang sudah ada. Snapshot
  pengaman diambil otomatis tepat sebelum setiap impor, jadi Anda bisa
  mengembalikannya dari tab **Cadangan**.
* Baris yang tidak bisa diurai dengan bersih (tanda kutip yang langsung
  diikuti koma) dijatuhkan dan dilaporkan, bukan ditulis sebagai data yang
  bergeser kolom.
* **Ekspor CSV** mengunduh proyeknya; Anda bisa memilih bahasa dan apakah
  akan menyertakan kolom konteks penerjemah.
* Ekspor menulis teks sesuai yang tersimpan, tanpa menambahkan apostrof di depan sel yang diawali = + - atau @. Pada **Ekspor untuk**, **Editor game** adalah pilihan default. Pilih **Excel atau Sheets** hanya untuk berkas yang akan dilihat di spreadsheet: pilihan ini menambahkan apostrof tersebut, yang dipertahankan editor Miliastra sebagai teks, dan pilihan direset setelah setiap ekspor. Berkas skrip klien yang dilindungi tidak boleh diimpor ulang atau dikirim ke editor. Proses terjemahan melewati baris yang nilai Need translation?-nya FALSE.

### Berkas skrip klien

CSV dengan kolom **Text Mapping ID** adalah berkas skrip klien. Berkas ini diimpor ke koleksinya sendiri, **Teks skrip klien**, terpisah dari **Teks utama** Anda — lembar impor memberi tahu koleksi mana yang terdeteksi.

* Setiap string klien dikenali dari Text Mapping ID-nya, sehingga teks Inggris yang sama bisa muncul di kedua koleksi, dan di beberapa baris klien, tanpa digabungkan.
* Mengimpor berkas klien tidak pernah mengubah teks utama, dan mengimpor berkas utama tidak pernah mengubah teks klien.
* Saat teks Inggris pada kunci yang sudah ada berubah, dalam mode impor apa pun, baris lama pindah ke tab **Entri Yatim** dan baris baru mempertahankan terjemahan dari berkas; hanya sel kosongnya yang belum diterjemahkan. Gunakan **Hubungkan ulang** untuk memindahkan terjemahan: baris dengan kunci yang sama disarankan lebih dulu, dan mode penimpaan menentukan apakah sel yang sudah terisi dipertahankan atau diganti.
* Setelah proyek memiliki string klien, **Ekspor CSV** memungkinkan Anda memilih koleksi yang diunduh, dan ekspor klien tetap menyertakan kolom Text Mapping ID.

## Modul dan model

Aktifkan penyedia sekali di **Konfigurasi Global**. Di sini, di
Konfigurasi, Anda memilih **model** dan **upaya penalaran** untuk setiap
modul yang diaktifkan per proyek — atau biarkan diatur ke
*Warisi dari konfigurasi global*. Modul mana yang sebenarnya berjalan untuk
sebuah entri ditentukan oleh **aturan penyaluran** (lihat panduan
*Penyaluran*).

## Pemeriksaan LQA

Panel **Pemeriksaan LQA** mengatur gerbang kualitas yang berjalan pada
setiap terjemahan: alihkan tiap pemeriksaan (kesetaraan tag, batas
panjang, luapan, kepatuhan glosarium, istilah terlarang, asersi regex, dan
lainnya) dan atur masing-masing ke **Memblokir** atau **Peringatan**. Isu
yang memblokir menggagalkan gerbang dan bisa memicu satu percobaan ulang
otomatis; peringatan hanya dilaporkan.

## Pengelompokan batch

**Pengelompokan batch** menjaga entri yang berkaitan (menurut kategori
dan/atau glosarium) tetap dalam satu permintaan yang sama sehingga model
melihatnya dalam konteks. Anda bisa mengatur bawaan proyek dan menimpanya
per putaran.

## Pengelolaan proyek

**Zona berbahaya** memungkinkan Anda **Duplikatkan** proyek (konfigurasi
dan entri, tidak pernah rahasianya) atau **Hapus** secara permanen.
