# Pseudo Test

## Ringkasan

**Pseudo Test** bukan bahasa sungguhan. Ini adalah bahasa QA gratis dan
offline yang menulis ulang teks sumber Anda menjadi versi yang sengaja
dirusak, sehingga Anda bisa memuatnya ke dalam game dan melihat teks mana
yang merusak antarmuka — sebelum satu pun terjemahan sungguhan ada.

Tidak berbiaya apa pun, tidak perlu kunci API, dan tidak pernah mengirim
apa pun ke penyedia mana pun.

## Apa yang dihasilkannya

`Save changes` menjadi sesuatu seperti `⟦Şàvé çhàñgéş~~~~⟧`. Tiga hal
terjadi sekaligus, dan masing-masing menyingkap jenis bug yang berbeda:

* **Huruf beraksen.** Setiap huruf ditukar dengan huruf serupa yang
  beraksen. Teks apa pun yang masih muncul sebagai bahasa Inggris polos di
  game Anda tidak pernah tertarik ke tabel teks — teks itu tertanam di
  kode, dan tidak akan pernah bisa dijangkau penerjemah mana pun.
* **Padding.** Teksnya diregangkan dengan karakter `~` hingga sekitar 1,4×
  panjang aslinya, mensimulasikan bahasa seperti Jerman yang cenderung
  panjang. Label yang meluap dari tombolnya, membungkus dengan buruk, atau
  mendorong tata letaknya akan langsung terlihat.
* **Kurung.** Hasilnya dibungkus dalam `⟦…⟧`. Jika salah satu kurungnya
  hilang di layar, berarti teks itu sedang dipotong.

Placeholder dan tag markup dalam teks Anda lolos tanpa disentuh, jadi jika
salah satunya keluar dalam keadaan rusak, itu adalah bug yang patut
dilaporkan, bukan masalah tata letak.

## Memakainya

1. Di tab **Data**, centang **Pseudo Test** di bawah *Bahasa target* lalu
   simpan.
2. Jalankan penerjemahan seperti biasa. Entri Pseudo Test selalu ditangani
   oleh generator pseudo bawaan — tidak ada yang perlu diaktifkan, tidak
   ada aturan penyaluran yang perlu ditulis, dan tanpa biaya. Penyedia
   berbayar Anda tidak pernah melihat teks ini.
3. Terjemahan sungguhan Anda aman: teks Pseudo Test tersimpan di kolomnya
   sendiri dan tidak akan pernah bisa menimpa bahasa lain.

## Memasukkannya ke dalam game Anda

Di kartu ekspor, atur **Ekspor teks pseudo sebagai** ke sebuah bahasa yang
tidak sedang Anda kirimkan — Jerman, misalnya — lalu unduh berkasnya dan
muat di game dengan bahasa itu dipilih. Kolom bahasa yang dipilih diisi
dengan teks Pseudo Test hanya untuk satu unduhan itu; tidak ada yang
tersimpan berubah, dan terjemahan sungguhannya masih ada di ekspor
berikutnya.

Saat Anda selesai menguji, ekspor lagi dengan penggantiannya dikembalikan
ke **Tanpa penggantian**. Ekspor normal tidak pernah berisi kolom Pseudo
Test — teks pseudo hanya bisa mencapai game Anda melalui penggantian di
atas — jadi membiarkan Pseudo Test tetap aktif tidak memengaruhi berkas
yang Anda kirimkan.

## Kapan memakainya

Jalankan pemeriksaan pseudo lebih awal, sebelum Anda memesan penerjemahan
apa pun. Setiap bug tata letak yang ditemukannya adalah bug yang Anda
perbaiki sekali, bukan lima belas kali setelah lima belas bahasa datang.
