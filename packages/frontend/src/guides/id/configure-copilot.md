# Modul GitHub Copilot

## Ringkasan

Modul **Copilot** menerjemahkan melalui GitHub Copilot. Modul ini melakukan
autentikasi dengan token GitHub dari akun yang memiliki **langganan Copilot
aktif**, disimpan dalam brankas kredensial di bawah kunci `GITHUB_TOKEN`.

## Menambahkan token ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **GitHub Copilot**. Jika kunci
   yang diperlukan belum ada, editor brankas otomatis terbuka pada kunci
   yang tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `GITHUB_TOKEN`,
   tempelkan token Anda sebagai nilainya, masukkan **kata sandi brankas**
   Anda, lalu klik **Simpan**.

Jika daftar model menampilkan *Tidak ada model yang tersedia*, berarti
tokennya belum ada, tidak valid, atau brankasnya terkunci — buka kunci
brankas atau periksa token GitHub Anda, lalu buka kembali kartunya.

## Mendapatkan token GitHub

Gunakan personal access token **fine-grained** agar hanya memberi akses
Copilot dan tidak ada yang lain.

1. Kunjungi
   [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Klik **Generate new token** (token fine-grained adalah bawaannya).
3. Beri nama (mis. “Translator-Copilot”) dan atur **Expiration**.
4. Di **Permissions → Account permissions**, cari **Copilot Requests** dan
   atur ke **Read-only**. Tidak ada izin lain yang diperlukan.
5. Klik **Generate token** lalu segera salin — GitHub hanya menampilkannya
   sekali.
6. Tempelkan ke nilai `GITHUB_TOKEN` di editor brankas.

Akun di balik token itu harus memiliki langganan Copilot aktif agar
penerjemahan berhasil.
