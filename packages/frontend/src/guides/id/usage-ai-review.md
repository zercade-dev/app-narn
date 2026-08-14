# Tinjauan AI

## Ringkasan

Selain pemeriksaan LQA otomatis, aplikasi ini bisa memakai model AI untuk
meninjau konten Anda. Ada dua tab tinjauan AI ditambah satu antrean tinjauan
manual. Semua tinjauan AI memerlukan modul LLM yang diaktifkan di
**Konfigurasi Global** dan brankas kredensial yang sudah terbuka kuncinya.

## Tinjauan AI Terjemahan

Tab **Tinjauan AI Terjemahan** memakai AI penilai untuk menilai terjemahan
yang sudah selesai dari sisi **ketepatan, kelancaran, terminologi, dan
nada**.

* Klik **Tinjau putaran terakhir** untuk menilai putaran penerjemahan
  selesai yang paling baru (atau mulai tinjauan dari putaran tertentu di
  tab **Aktivitas**).
* Telusuri hasil yang ditandai satu per satu; setiap putusan menampilkan
  sumber, terjemahan, sebuah **skor**, dan sering kali sebuah **saran**.
* **Terapkan** sebuah saran untuk mengganti terjemahannya, atau
  **Terapkan semua saran** untuk menerapkan semuanya sekaligus. Sebuah
  peringatan muncul jika sebuah saran akan menghilangkan tag, placeholder,
  atau pemisah baris.

## Tinjauan AI Sumber

Tab **Tinjauan AI Sumber** memeriksa **teks sumber itu sendiri** — hasilnya
hanya laporan dan tidak pernah mengubah terjemahan.

1. Pilih pemeriksaan yang akan dijalankan: **salah ketik**, **tata bahasa**,
   **terminologi**, **kejelasan**, dan konten **tidak aman**.
2. Pilih **modul** dan **model**, dan opsional **bahasa balasan** untuk
   temuannya.
3. Klik **Mulai tinjauan**. Ini berjalan di latar belakang — pantau
   kemajuannya di tab **Aktivitas**.
4. Tinjau setiap temuan dan **Setujui** atau **Abaikan**; usulan penulisan
   ulang sumber bisa disalin.

## Tinjauan Manual

Tab **Tinjauan Manual** adalah antrean tinjauan oleh manusia. Terjemahan
yang ditandai **Perlu ditinjau** (atau **Disisihkan**) muncul di sini,
tempat Anda bisa **Setujui**, **Sunting**, **Sisihkan**,
**Terjemahkan ulang**, atau meminta **terjemahan balik** ke sumber sebagai
rujukan. Pintasan papan tik mempercepatnya: `↑`/`↓` untuk berpindah, `a`
untuk menyetujui, `e` untuk menyunting.
