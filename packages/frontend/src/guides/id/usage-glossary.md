# Tab Glosarium

## Ringkasan

Tab **Glosarium** menjaga konsistensi terminologi. Sebuah proyek bisa
menyimpan beberapa glosarium; masing-masing adalah daftar istilah sumber
dengan terjemahan per bahasa target. Glosarium dicocokkan dengan entri
secara otomatis dan istilah yang cocok diteruskan ke model saat
menerjemahkan.

## Glosarium dan istilah

* Buat glosarium dengan **Glosarium baru**; ganti nama atau hapus nanti.
* **Aktifkan** atau **Nonaktifkan** sebuah glosarium — glosarium yang
  nonaktif diabaikan saat impor dan penerjemahan.
* Tambahkan istilah dengan **sumber**, **terjemahan per bahasa**, dan
  **catatan** opsional.
* Tandai sebuah istilah **konstan** jika harus keluar persis seperti yang tertulis di glosarium, seperti nama karakter atau merek — lihat *Istilah konstan* di bawah.
* Glosarium punya dua tab: **Istilah** menampilkan istilahnya, dan **Kecocokan** menampilkan entri yang berisi istilah itu, tempat Anda bisa menugaskan glosarium ke entri atau melepasnya.

Beberapa glosarium bersifat **hanya-baca** (dikelola secara global) dan
menyumbangkan istilah tanpa bisa disunting di sini.

## Istilah konstan

* Istilah konstan **tidak pernah dikirim ke mesin terjemahan**. NARN menggantinya dengan penanda sebelum menerjemahkan, lalu memasukkan terjemahan glosarium di tempatnya, jadi nama karakter seperti *Diluc* selalu keluar persis seperti yang tertulis di glosarium.
* **Huruf besar dan kecil berpengaruh.** Hanya teks yang ditulis persis seperti istilahnya yang dilindungi: *Razor* (karakter) dilindungi, *a razor* tidak. Ejaan lain dikirim ke mesin sebagai petunjuk glosarium biasa yang ditandai sebagai nama, agar mesin bisa membedakan nama dari kata sehari-hari.
* **Mesin tidak bisa mengubah kata itu.** Karena tidak pernah melihat istilahnya, mesin tidak bisa mengubah bentuknya atau menyesuaikan kata lain dengannya: dalam bahasa seperti Rusia, Korea, atau Turki, nama konstan selalu muncul dalam bentuk dasarnya. Gunakan konstan untuk nama dan kode yang harus tetap.
* Biarkan nama yang juga kata sehari-hari sebagai istilah biasa, karena judul dan label sering menulisnya dengan huruf besar (*Gaming Settings*). Di glosarium bawaan **Genshin Characters**, semua nama konstan kecuali Gaming, Amber, Razor, Sucrose, dan Prune.

## Impor dan ekspor

Impor istilah dari **CSV** atau **TBX** — pratinjau menunjukkan berapa
banyak istilah yang ditambahkan, diperbarui, atau bentrok sebelum Anda
menerapkannya. Ekspor glosariumnya kembali ke **CSV** atau **TBX**.

## Buat dengan AI

* **Buat glosarium** memindai teks sumber dan mengusulkan glosarium berisi
  nama dan istilah khas yang berulang. Ini berjalan di latar belakang —
  pantau di tab **Aktivitas** dan tinjau sarannya sebelum membuatnya. Anda
  bisa meneruskan glosarium yang sudah ada sebagai “sudah diketahui” agar
  model tidak mengulanginya.
* **Buat terjemahan** mengisi terjemahan target untuk istilah yang masih
  belum memilikinya.

## DeepL

Jika Anda menerjemahkan dengan DeepL, gunakan **Kirim ke DeepL** untuk
mengunggah istilah glosarium. Setelah menyunting glosarium yang sudah
dikirim, tab akan menampilkan *Perlu dikirim ulang* — kirim lagi untuk
memperbarui DeepL.

## Kendali per entri

Dari tab Terjemahan Anda bisa memilih glosarium mana yang **diaktifkan**
untuk entri tertentu.
