# Modul Anthropic (Claude)

## Ringkasan

Modul **Claude** menerjemahkan dengan model Claude dari Anthropic. Modul ini
memerlukan kunci API Anthropic, yang disimpan dalam brankas kredensial di
bawah kunci `ANTHROPIC_API_KEY`.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **Anthropic (Claude)**. Jika
   kunci yang diperlukan belum ada, editor brankas otomatis terbuka pada
   kunci yang tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `ANTHROPIC_API_KEY`,
   tempelkan kunci Anda sebagai nilainya, masukkan **kata sandi brankas**
   Anda, lalu klik **Simpan**. Menyimpan berarti mengenkripsi ulang brankas.

Jika sebuah kartu kemudian menampilkan *Brankas terkunci*, klik
**Buka kunci brankas** sebelum menerjemahkan.

## Memilih model

Di tab **Konfigurasi** sebuah proyek, pilih model Claude (dan upaya penalaran
opsional), atau biarkan mewarisi bawaan global. **Aturan penyaluran** di tab
Penyaluran menentukan modul mana yang menangani tiap bahasa.

## Mendapatkan kunci API Anthropic

1. Kunjungi [console.anthropic.com](https://console.anthropic.com).
2. Daftar atau masuk.
3. Buka bagian **API keys**.
4. Klik **Create Key** lalu salin kuncinya.
5. Tempelkan ke nilai `ANTHROPIC_API_KEY` di editor brankas.
