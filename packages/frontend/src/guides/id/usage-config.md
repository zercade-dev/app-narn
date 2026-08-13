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
