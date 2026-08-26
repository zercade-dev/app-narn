# Tanya Jawab

## Ikhtisar

Jawaban singkat untuk pertanyaan yang paling sering muncul, masing-masing menunjuk ke panduan yang membahas topiknya secara mendalam. Daftar ini bertambah seiring datangnya pertanyaan baru, jadi kalau pertanyaan Anda belum ada di sini, daftar topik di sebelah kiri membahasnya jauh lebih rinci.

## Apa yang diterjemahkan

### Entri mana yang diterjemahkan sebuah proses, dan mana yang dilewati?

Hanya yang masih memerlukannya. Untuk setiap entri dan setiap bahasa tujuan yang Anda pilih, proses menerjemahkan pasangan itu bila belum ada terjemahannya — atau bila Anda secara eksplisit meminta **terjemahkan ulang**. Pasangan yang sudah punya teks dibiarkan apa adanya, jadi menjalankan ulang terjemahan tidak pernah menimpa pekerjaan yang sudah Anda selesaikan atau tinjau.

Sebuah entri, atau satu pasangan entri-dan-bahasa, dikecualikan bila salah satu dari ini benar:

* **Sudah diterjemahkan**, dan Anda tidak meminta terjemahan ulang.
* **Anda menandainya Diabaikan.** Itu mengeluarkannya dari *semua* operasi AI — terjemahan, tinjauan AI, tinjauan sumber, serta pembuatan glosarium atau kategori. Entri yang diabaikan tetap terlihat di tabel dengan lencana, sehingga keputusannya selalu terlihat dan selalu bisa dibatalkan.
* **Entrinya yatim** — hilang dari impor CSV terakhir Anda dan menunggu di tab [Entri Yatim](guide:usage-orphans).
* **Diimpor dengan `Apakah perlu diterjemahkan = FALSE`.** Lihat di bawah.
* **Tujuannya adalah bahasa sumber.** Sebuah entri tidak pernah diterjemahkan ke bahasa sumbernya sendiri, sekalipun Anda memilih bahasa itu sebagai tujuan.
* **Tidak ada yang perlu diterjemahkan.** Teks kosong, angka seperti `3.14` atau `100%`, URL yang berdiri sendiri, warna heksadesimal seperti `#ff8800`, atau string yang hanya berisi tag dan placeholder seperti `<b>{count}</b>` disalin apa adanya, tanpa memanggil penyedia mana pun.

Entri yang diisi dari [Memori Terjemahan](guide:usage-translation-memory) juga tidak pernah sampai ke penyedia — terjemahan tersimpan dipakai ulang. Entri itu tetap dihitung sebagai sudah diterjemahkan.

### Bisakah saya menerjemahkan ulang sesuatu yang sudah diterjemahkan?

Bisa, tetapi Anda harus memintanya, karena proses melewati pasangan yang sudah selesai secara bawaan. Centang **terjemahkan ulang** di dialog *Terjemahkan…* untuk satu batch, atau gunakan **Terjemahkan ulang** pada satu baris di tab [Bandingkan](guide:usage-compare) atau di antrean tinjauan manual.

### Mengapa sebuah entri kembali dengan teks sumber yang tidak berubah?

Hampir selalu karena tidak ada yang bisa diterjemahkan — butir terakhir pada daftar di atas. Angka, URL, warna, dan markah murni dikenali lalu disalin apa adanya, sebab model hanya bisa mengulanginya atau merusaknya. Untuk entri-entri itu tidak ada yang dikirim ke penyedia dan tidak ada biaya yang timbul.

### Apa itu kolom “Apakah perlu diterjemahkan” di CSV saya, dan apa bedanya dengan Diabaikan?

**Apakah perlu diterjemahkan** adalah kolom impor opsional. Baris yang nilainya `FALSE` tetap diimpor dan disimpan, tetapi diperlakukan sebagai bukan untuk diterjemahkan: baris itu tersaring seluruhnya dari tab **Terjemahan** dan tidak pernah masuk ke sebuah proses. Gunakan untuk baris yang harus melewati perjalanan bolak-balik CSV tanpa tersentuh. Kolom ini hanya ditetapkan saat impor — tidak ada sakelarnya di dalam aplikasi — jadi untuk mengubahnya, sunting kolomnya lalu impor ulang.

**Diabaikan** adalah padanannya di dalam aplikasi, dan berbeda pada satu hal yang penting: entri yang diabaikan tetap terlihat di tabel dengan lencana, jadi Anda bisa melihatnya dan berubah pikiran. Gunakan *Apakah perlu diterjemahkan* untuk baris yang seharusnya tidak pernah ditampilkan aplikasi, dan **Abaikan entri** untuk baris yang ingin Anda pantau.

## Penyedia, model, dan penyaluran

### Bagaimana cara mengganti model yang dipakai untuk menerjemahkan?

Ada tiga tingkat, dan yang Anda perlukan bergantung pada seberapa luas perubahannya harus berlaku:

1. **Untuk sebuah penyedia di mana saja** — buka **Konfigurasi Global**, cari modulnya, lalu pilih **model**-nya di sana. Setiap proyek yang disetel *Warisi dari konfigurasi global* akan mengikutinya.
2. **Untuk satu proyek** — buka tab [Konfigurasi](guide:usage-config) proyek itu dan tetapkan **model** (serta **upaya penalaran**) untuk modulnya, alih-alih mewarisi.
3. **Hanya untuk sebagian entri** — buka tab [Penyaluran](guide:usage-routing), beralih ke **Lanjutan**, lalu tetapkan **penimpaan model** pada sebuah aturan penyaluran. Hanya entri yang cocok dengan aturan itu yang memakainya.

Tampilan sederhana tab Penyaluran memilih **penyedia**, bukan model: ia sengaja menjalankan model yang sudah dikonfigurasi pada modul tersebut.

### Bisakah bahasa yang berbeda memakai penyedia yang berbeda?

Bisa. Alihkan tab [Penyaluran](guide:usage-routing) ke **Lanjutan** lalu tambahkan satu aturan per bahasa — atau per kategori, atau per panjang entri. Aturan dievaluasi menurut prioritas dan yang pertama cocok dengan sebuah entri yang menang. Kalau Anda lebih suka tidak memilih sama sekali, arahkan satu aturan ke [NARN Freeway](guide:usage-freeway) dan biarkan ia memilih model gratis untuk setiap batch.

### Terjemahan tidak mau mulai dan menyebut tidak ada aturan penyaluran. Sekarang bagaimana?

Sebuah proses baru mulai kalau setiap bahasa di dalamnya punya tujuan. Jika sebuah bahasa tujuan tidak cocok dengan aturan mana pun, proses ditolak sebelum apa pun dikirim dan pesannya menyebut bahasa tersebut. Buka tab [Penyaluran](guide:usage-routing) lalu tambahkan aturan yang mencakupnya — pemilih penyedia yang sederhana mencakup semua bahasa sekaligus — kemudian mulai lagi.

## Proses, kegagalan, dan pemulihan

### Beberapa string gagal. Apakah saya harus menjalankan semuanya lagi?

Tidak. Gunakan **Coba ulang yang gagal** pada proses itu di tab [Aktivitas](guide:usage-activity): hanya pasangan entri-dan-bahasa yang error yang dijalankan ulang, sementara semua yang berhasil dibiarkan.

### Mengapa saya harus membuka brankas lagi?

[Brankas kredensial](guide:usage-vault) dibuka per sesi, bukan selamanya, dan ia juga mengunci diri sendiri setelah beberapa lama tanpa aktivitas. Buka kuncinya lalu lanjutkan. Kalau ada proses yang sedang berjalan saat brankas mengunci, sesudahnya gunakan **Coba ulang yang gagal** pada proses tersebut.

### Saya mengimpor ulang CSV dan sebagian terjemahan hilang. Apakah hilang selamanya?

Tidak. Ketika impor ulang tidak lagi memuat sebuah entri, terjemahannya disimpan di tab [Entri Yatim](guide:usage-orphans), bukan dihapus. **Tautkan ulang** entri yatim ke entri yang menggantikannya untuk memindahkan terjemahannya; pada entri tujuan hanya bahasa yang kosong yang diisi, jadi tidak ada yang tertimpa. Sebuah snapshot juga diambil otomatis tepat sebelum setiap impor, jadi Anda bisa mengembalikan seluruh proyek dari tab [Cadangan](guide:usage-backup).
