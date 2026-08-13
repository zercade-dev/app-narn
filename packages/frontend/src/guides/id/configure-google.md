# Modul Google AI (Gemini)

## Ringkasan

Modul **Google AI** menerjemahkan dengan model Gemini dari Google. Modul ini
memerlukan kunci API Google AI Studio, yang disimpan dalam brankas
kredensial di bawah kunci `GOOGLE_API_KEY`.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **Google AI (Gemini)**. Jika
   kunci yang diperlukan belum ada, editor brankas otomatis terbuka pada
   kunci yang tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `GOOGLE_API_KEY`,
   tempelkan kunci Anda sebagai nilainya, masukkan **kata sandi brankas**
   Anda, lalu klik **Simpan**.

Jika sebuah kartu kemudian menampilkan *Brankas terkunci*, klik
**Buka kunci brankas** sebelum menerjemahkan.

## Memilih model

Di tab **Konfigurasi** sebuah proyek, pilih model Gemini (dan upaya
penalaran opsional), atau warisi bawaan global. **Aturan penyaluran** di tab
Penyaluran menentukan modul mana yang menangani tiap bahasa. Model thinking
melaporkan jumlah token yang besar relatif terhadap jumlah karakter, jadi
perkiraan biaya bisa tampak tinggi.

## Mendapatkan kunci API Google

1. Kunjungi [ai.google.dev](https://ai.google.dev) lalu klik
   **Get API key**, atau langsung ke
   [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Klik **Create API key** lalu pilih proyek Anda.
3. Salin kunci yang dihasilkan.
4. Tempelkan ke nilai `GOOGLE_API_KEY` di editor brankas.
