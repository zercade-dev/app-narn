# Modul DeepSeek

## Ringkasan

Modul **DeepSeek** menerjemahkan dengan API DeepSeek. Modul ini memerlukan
kunci API DeepSeek, yang disimpan dalam brankas kredensial di bawah kunci
`DEEPSEEK_API_KEY`.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **DeepSeek**. Jika kunci yang
   diperlukan belum ada, editor brankas otomatis terbuka pada kunci yang
   tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `DEEPSEEK_API_KEY`,
   tempelkan kunci Anda sebagai nilainya, masukkan **kata sandi brankas**
   Anda, lalu klik **Simpan**.

Jika sebuah kartu kemudian menampilkan *Brankas terkunci*, klik
**Buka kunci brankas** sebelum menerjemahkan.

## Memilih model

Di tab **Konfigurasi** sebuah proyek, pilih model DeepSeek (dan upaya
penalaran opsional), atau warisi bawaan global. **Aturan penyaluran** di tab
Penyaluran menentukan modul mana yang menangani tiap bahasa.

## Mendapatkan kunci API DeepSeek

1. Kunjungi [platform.deepseek.com](https://platform.deepseek.com).
2. Daftar atau masuk.
3. Buka bagian **API keys** Anda.
4. Buat kunci API baru lalu salin.
5. Tempelkan ke nilai `DEEPSEEK_API_KEY` di editor brankas.
