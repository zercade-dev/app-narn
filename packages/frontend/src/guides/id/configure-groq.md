# Modul Groq

## Ringkasan

Modul **Groq** menerjemahkan dengan [Groq](https://groq.com) — inferensi
cepat untuk model terbuka seperti Llama, Qwen, dan GPT-OSS, dengan tingkat
gratis yang cocok untuk pekerjaan terjemahan sehari-hari. Modul ini
memerlukan kunci API Groq, yang disimpan dalam brankas kredensial di bawah
kunci `GROQ_API_KEY`.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **Groq**. Jika kunci yang
   diperlukan belum ada, editor brankas otomatis terbuka pada kunci yang
   tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `GROQ_API_KEY`,
   tempelkan kunci Anda sebagai nilainya, masukkan **kata sandi brankas**
   Anda, lalu klik **Simpan**.

Jika sebuah kartu kemudian menampilkan *Brankas terkunci*, klik
**Buka kunci brankas** sebelum menerjemahkan.

## Memilih model

Di tab **Konfigurasi** sebuah proyek, pilih model dari katalog Groq
langsung, atau warisi bawaan global. `llama-3.3-70b-versatile` adalah
pilihan bawaan yang solid untuk kualitas terjemahan; model yang lebih
kecil seperti `llama-3.1-8b-instant` menukar sedikit kualitas demi
kecepatan. **Aturan penyaluran** di tab Penyaluran menentukan modul mana
yang menangani tiap bahasa.

## Mendapatkan kunci API Groq

1. Kunjungi [console.groq.com](https://console.groq.com).
2. Daftar atau masuk.
3. Buka **API Keys** dari menu konsol.
4. Buat kunci API baru lalu salin — kunci ini diawali dengan `gsk_`.
5. Tempelkan ke nilai `GROQ_API_KEY` di editor brankas.

Tingkat gratis Groq menerapkan batas harian per model (tidak ada angka
pasti di sini — periksa konsol Anda untuk batas terkini), dan sesuai
ketentuan Groq, data API tidak digunakan untuk melatih model. Setelah
kunci Anda ditambahkan, **NARN Freeway** otomatis menyertakan paket gratis
Groq saat menyebarkan pekerjaan terjemahan ke seluruh kuota gratis
penyedia yang terhubung dengan Anda — tanpa penyiapan tambahan.
