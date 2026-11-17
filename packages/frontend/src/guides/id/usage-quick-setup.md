# Persiapan Cepat

## Ringkasan

Baru di NARN? Jalur singkat di bawah membawa Anda dari nol hingga terjemahan yang diekspor dalam lima langkah. Penyiapan terpandu di dalam aplikasi menuntun Anda melalui langkah yang sama, dan Anda bisa melewatinya lalu melanjutkannya nanti — **Lanjutkan penyiapan** di bilah samping melanjutkan dari tempat Anda berhenti, dan Anda bisa memulainya ulang dari Panduan ini. Semua yang ada setelah jalur singkat ditujukan bagi Anda yang ingin kontrol lebih.

## Jalur singkat

1. **Buat kata sandi brankas Anda.** Kunci penyedia Anda dienkripsi dengannya — lihat panduan [Brankas Kredensial](guide:usage-vault). Pada versi cloud, langkah 1 dan 2 dilakukan bersamaan di halaman brankas.
2. **Tambahkan satu kunci gratis.** Kunci Google AI adalah awal yang paling mudah — dapatkan di [aistudio.google.com/apikey](https://aistudio.google.com/apikey), atau pilih **Gunakan penyedia saya sendiri**. [NARN Freeway](guide:usage-freeway) lalu memilihkan model gratis untuk Anda.
3. **Buat proyek dan impor teks Anda.** Buat proyek, lalu di tab **Data** pilih bahasa sumber dan bahasa tujuan terjemahan, dan gunakan **Impor CSV**.
4. **Terjemahkan.** Di **Terjemahan**, pilih semua entri lalu klik **Terjemahkan**. NARN Freeway memilihkan model gratis untuk Anda; pantau kemajuan di **Aktivitas**.
5. **Ekspor.** Unduh berkas terjemahan Anda dari proyek.

Pengguna baru memulai dalam **mode Sederhana**, yang hanya menampilkan Konfigurasi, Data, Terjemahan, dan Aktivitas (plus Panduan, Pengaturan, dan **Kunci penyedia**). Beralihlah antara **Sederhana** dan **Lanjutan** dari bilah atas atau di Pengaturan kapan saja.

## Jika Anda ingin lebih

Langkah-langkah ini ada di **mode Lanjutan** dan meningkatkan kualitas atau memberi kontrol yang lebih halus. Langkah bertanda *(Optional)* tidak diperlukan untuk terjemahan pertama — lewati dan kembali nanti. Saat pertama kali Anda membuka Penyaluran, Glosarium, Kualitas, Bandingkan, atau Tinjauan AI Terjemahan di mode Lanjutan, tur singkat ditawarkan; Anda bisa memulai tur mana pun lagi dari Panduan ini, atau mematikan tawarannya di Pengaturan.

## Tambahkan penyedia dan kredensial lain

1. Buka **Konfigurasi Global** dan **aktifkan sebuah modul** untuk setiap penyedia yang Anda inginkan (Anthropic, OpenAI, DeepL, dan sebagainya) dari daftar **Aktifkan sebuah modul** — DeepL tercantum dengan namanya, sedangkan penyedia AI muncul sebagai **Tambahkan instans … lagi…**, yang membuat instans pertama penyedia itu. Sebuah modul bisa memiliki beberapa **instans bernama** — berguna untuk dua konfigurasi dari penyedia yang sama dengan kunci atau bawaan yang berbeda.
2. Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi —
   siapkan saat pertama kali dipakai dan buka kuncinya sekali per sesi.
   Lihat panduan *Brankas Kredensial* untuk cara kerjanya.
3. Pilih **model** (dan **upaya penalaran** opsional) per modul atau
   instans. Model yang lebih murah menerjemahkan lebih buruk, jadi
   perkirakan akan ada coba-coba untuk menemukan titik terbaik Anda.
   Perhatikan **upaya penalaran** — pada model thinking hal ini bisa
   melipatgandakan biaya dengan cepat.

## *(Optional)* Tinjau dulu teks sumber Anda

Jalankan **Tinjauan AI Sumber** pada bahasa sumber sebelum menerjemahkan —
memperbaiki salah ketik dan frasa yang tidak jelas di sini memberi manfaat
untuk setiap terjemahan yang dibuat sesudahnya. Jika sebuah perbaikan
mengubah entri yang sudah punya terjemahan, terjemahan lamanya berpindah
ke tab **Entri Yatim** — **hubungkan ulang** entri itu, dengan
penerjemahan ulang opsional.

## *(Optional)* Aktifkan glosarium

Di tab **Glosarium**, aktifkan glosarium yang berlaku untuk proyek Anda.
Terapan otomatisnya mencocokkan istilah sebagai **kata utuh, tanpa peduli
huruf besar/kecil** — bentuk berimbuhan (jamak, konjugasi) tidak akan
tertangkap. Menerjemahkan dengan **DeepL**? Kirim glosarium ke sana dengan
**Kirim ke DeepL** (kanan atas), dan kirim ulang setelah menyunting.

## Siapkan penyaluran

Buka tab **Penyaluran** dan pilih penyedia Anda dari pemilih tempat tab itu
terbuka — itu mengirim setiap entri dalam proyek ke penyedia tersebut, yang
sudah cukup untuk pengaturan satu-penyedia. Ingin penyedia berbeda per bahasa,
kategori, atau panjang entri? Beralih ke **Lanjutan** dan tambahkan **aturan
penyaluran** di sana. Pilihan Anda tersimpan otomatis apa pun caranya. Proyek
tanpa aturan sama sekali mengirim semuanya lewat NARN Freeway, jadi langkah
ini opsional di awal. Setelah proyek punya aturan, entri yang tidak cocok
dengan satu pun gagal diterjemahkan dengan galat *“tidak ada rute”*.

## *(Optional)* Bangun glosarium dari konten Anda sendiri

Kembangkan glosarium Anda sebelum penerjemahan massal: tambahkan istilah
secara manual, jalankan **Buat glosarium** pada seluruh sumber, atau — lebih
tertarget — pilih entri kandidat yang baik di **Terjemahan** dan gunakan
**Buat glosarium dari pilihan** (sertakan terjemahan yang sudah ada).
Pakai model yang mumpuni di sini; kualitas glosarium terakumulasi pada
semua yang diterjemahkan sesudahnya.

## *(Optional)* Sempurnakan kualitas di Bandingkan dulu

Sebelum putaran penerjemahan penuh, gunakan tab **Bandingkan** untuk
menyempurnakan satu bahasa yang bisa Anda nilai sendiri:

- Sempurnakan **konteks** tiap entri (karakter, nada, catatan) dan
  glosariumnya sampai terjemahannya terasa pas. Konteks disimpan per
  entri, bukan per bahasa, jadi hasil kerjanya otomatis terbawa ke setiap
  bahasa lain.
- Karena Anda menyempurnakan entri demi entri, model murah atau gratis
  sudah cukup di sini — misalnya kunci Gemini gratis (lihat panduan
  *Google AI (Gemini)*), ditambahkan sebagai **instans modul**-nya sendiri
  dengan penyaluran diarahkan ke sana untuk sementara. Tingkat gratisnya
  punya batas harian, jadi lebih baik kelompokkan permintaannya.
- Puas dengan hasilnya? Terjemahkan seluruh batch sekali dengan pengaturan
  yang sama untuk memastikan hasilnya tetap bagus dalam jumlah besar.

## Terjemahkan secara massal

Ada dua cara menjalankan penerjemahan sungguhan:

- **Terjemahan** — pilih entri dan **Terjemahkan yang dipilih** untuk
  mencakup semua bahasa target sekaligus.
- **Bandingkan** — satu bahasa dalam satu waktu, opsional dengan bahasa
  yang sudah ditinjau sebagai konteks **rujukan**.

Untuk proyek penuh, satu bahasa dalam satu waktu dengan bahasa rujukan
yang sudah ditinjau biasanya lebih unggul: tinjauan AI sesudahnya tetap
fokus pada satu bahasa. Pantau kemajuannya di tab **Aktivitas**.

Pengelompokan batch otomatis secara bawaan; untuk proyek kecil dengan
banyak entri pendek, ukuran batch khusus **0** (seluruh bahasa dalam satu
permintaan) bisa bekerja lebih baik dengan model yang mumpuni.

## Tinjau putarannya

Pilih salah satu:

- Picu **tinjauan AI** untuk putaran yang sudah selesai dari tab
  **Aktivitas**.
- Tinjau secara manual di **Tinjauan Manual** atau **Bandingkan**.
- Setujui semuanya apa adanya dan tinjau nanti.
