# Modul OpenRouter

## Ringkasan

Modul **OpenRouter** menerjemahkan dengan
[OpenRouter](https://openrouter.ai) — satu API yang menyalurkan ke model
dari banyak vendor (Anthropic, OpenAI, Google, Meta, dan lainnya). Modul ini
memerlukan kunci API OpenRouter, yang disimpan dalam brankas kredensial di
bawah kunci `OPENROUTER_API_KEY`.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **OpenRouter**. Jika kunci
   yang diperlukan belum ada, editor brankas otomatis terbuka pada kunci
   yang tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci
   `OPENROUTER_API_KEY`, tempelkan kunci Anda sebagai nilainya, masukkan
   **kata sandi brankas** Anda, lalu klik **Simpan**.

Jika sebuah kartu kemudian menampilkan *Brankas terkunci*, klik
**Buka kunci brankas** sebelum menerjemahkan.

## Memilih model

Di tab **Konfigurasi** sebuah proyek, pilih model dari katalog OpenRouter
langsung — setiap entri menampilkan harga per tokennya dan panjang
konteksnya, dan hanya model penghasil teks yang tercantum. Id model diberi
awalan vendor (misalnya `anthropic/claude-sonnet-4.5` atau
`openai/gpt-4o-mini`); Anda juga bisa mengetik slug baru secara langsung.
**Aturan penyaluran** di tab Penyaluran menentukan modul mana yang menangani
tiap bahasa.

## Mendapatkan kunci API OpenRouter

1. Kunjungi [openrouter.ai](https://openrouter.ai).
2. Daftar atau masuk.
3. Buka **Keys** dari menu akun Anda.
4. Buat kunci API baru lalu salin.
5. Tempelkan ke nilai `OPENROUTER_API_KEY` di editor brankas.

Catatan: teks Anda dikirim ke OpenRouter dan disalurkan lebih lanjut ke
vendor model yang Anda pilih, sesuai ketentuan OpenRouter dan kebijakan data
vendor tersebut.
