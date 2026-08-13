# Persiapan Cepat

## Ringkasan

Jalur lengkap untuk proyek baru: aktifkan penyedia, impor entri Anda,
konfigurasikan glosarium dan penyaluran, terjemahkan, lalu tinjau. Langkah
yang ditandai *(Optional)* meningkatkan kualitas tetapi tidak wajib untuk
penerjemahan pertama — lewati di percobaan pertama dan kembali lagi nanti.

## 1. Aktifkan penyedia dan simpan kredensial

1. Buka **Konfigurasi Global** dan **aktifkan sebuah modul** untuk setiap
   penyedia yang Anda inginkan (Anthropic, OpenAI, DeepL, dan sebagainya).
   Sebuah modul bisa memiliki beberapa **instans bernama** — berguna untuk
   dua konfigurasi dari penyedia yang sama dengan kunci atau bawaan yang
   berbeda.
2. Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi —
   siapkan saat pertama kali dipakai dan buka kuncinya sekali per sesi.
   Lihat panduan *Brankas Kredensial* untuk cara kerjanya.
3. Pilih **model** (dan **upaya penalaran** opsional) per modul atau
   instans. Model yang lebih murah menerjemahkan lebih buruk, jadi
   perkirakan akan ada coba-coba untuk menemukan titik terbaik Anda.
   Perhatikan **upaya penalaran** — pada model thinking hal ini bisa
   melipatgandakan biaya dengan cepat.

## 2. Buat proyek dan impor entri

Buat sebuah proyek, atur **bahasa sumber**-nya, lalu gunakan **Impor CSV**
di tab **Data** untuk memuat entri sumber Anda (beserta terjemahan apa pun
yang sudah ada dalam berkasnya).

## 3. *(Optional)* Tinjau dulu teks sumber Anda

Jalankan **Tinjauan AI Sumber** pada bahasa sumber sebelum menerjemahkan —
memperbaiki salah ketik dan frasa yang tidak jelas di sini memberi manfaat
untuk setiap terjemahan yang dibuat sesudahnya. Jika sebuah perbaikan
mengubah entri yang sudah punya terjemahan, terjemahan lamanya berpindah
ke tab **Entri Yatim** — **hubungkan ulang** entri itu, dengan
penerjemahan ulang opsional.

## 4. *(Optional)* Aktifkan glosarium

Di tab **Glosarium**, aktifkan glosarium yang berlaku untuk proyek Anda.
Terapan otomatisnya mencocokkan istilah sebagai **kata utuh, tanpa peduli
huruf besar/kecil** — bentuk berimbuhan (jamak, konjugasi) tidak akan
tertangkap. Menerjemahkan dengan **DeepL**? Kirim glosarium ke sana dengan
**Kirim ke DeepL** (kanan atas), dan kirim ulang setelah menyunting.

## 5. Siapkan penyaluran

Buka tab **Penyaluran** dan pilih penyedia Anda dari pemilih tempat tab
itu terbuka — itu mengirim setiap entri dalam proyek ke penyedia
tersebut, yang sudah cukup untuk pengaturan satu-penyedia. Ingin penyedia
berbeda per bahasa, kategori, atau panjang entri? Beralih ke **Lanjutan**
dan tambahkan **aturan penyaluran** di sana. Pilihan Anda tersimpan
otomatis apa pun caranya. Langkah ini wajib: entri tanpa aturan yang cocok
gagal diterjemahkan dengan galat *“tidak ada rute”*.

## 6. *(Optional)* Bangun glosarium dari konten Anda sendiri

Kembangkan glosarium Anda sebelum penerjemahan massal: tambahkan istilah
secara manual, jalankan **Buat glosarium** pada seluruh sumber, atau — lebih
tertarget — pilih entri kandidat yang baik di **Terjemahan** dan gunakan
**Buat glosarium dari pilihan** (sertakan terjemahan yang sudah ada).
Pakai model yang mumpuni di sini; kualitas glosarium terakumulasi pada
semua yang diterjemahkan sesudahnya.

## 7. *(Optional)* Sempurnakan kualitas di Bandingkan dulu

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

## 8. Terjemahkan

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

## 9. Tinjau putarannya

Pilih salah satu:

- Picu **tinjauan AI** untuk putaran yang sudah selesai dari tab
  **Aktivitas**.
- Tinjau secara manual di **Tinjauan Manual** atau **Bandingkan**.
- Setujui semuanya apa adanya dan tinjau nanti.
