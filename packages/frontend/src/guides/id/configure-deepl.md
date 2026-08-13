# Modul DeepL

## Ringkasan

Modul **DeepL** menyediakan terjemahan mesin neural profesional. Berbeda
dengan modul LLM, ini adalah MT klasik, dan modul ini bisa mengirim glosarium
proyek ke DeepL untuk terminologi yang konsisten. Kuncinya disimpan dalam
brankas kredensial di bawah `DEEPL_API_KEY`.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **DeepL**. Jika kunci yang
   diperlukan belum ada, editor brankas otomatis terbuka pada kunci yang
   tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `DEEPL_API_KEY`,
   tempelkan kunci autentikasi Anda sebagai nilainya, masukkan **kata sandi
   brankas** Anda, lalu klik **Simpan**.

DeepL tidak mendukung instans bernama — hanya ada satu modul DeepL.

## Memakai glosarium

DeepL bisa menerapkan glosarium saat menerjemahkan. Buat istilah di tab
**Glosarium**, lalu gunakan **Kirim ke DeepL** untuk mengunggahnya. Jika
glosarium berubah setelah dikirim, tab akan menampilkan *Perlu dikirim
ulang* — kirim lagi untuk memperbarui DeepL.

## Mendapatkan kunci API DeepL

1. Kunjungi [deepl.com/account](https://www.deepl.com/account).
2. Daftar untuk akun API Free atau Pro.
3. Buka **Account Settings** dan cari bagian **API Key**.
4. Salin kunci autentikasi Anda.
5. Tempelkan ke nilai `DEEPL_API_KEY` di editor brankas.
