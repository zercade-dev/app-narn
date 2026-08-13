# Modul Generic AI

## Ringkasan

Modul **Generic AI** terhubung ke API apa pun yang kompatibel dengan OpenAI —
penyedia yang dihosting atau server yang berjalan lokal (mis. Ollama, LM
Studio, vLLM). Kuncinya disimpan dalam brankas kredensial di bawah
`GENERIC_API_KEY`.

**Kunci API bersifat opsional.** Kunci ini hanya berarti untuk endpoint yang
memerlukan autentikasi (kebanyakan penyedia cloud berbayar). Server lokal
seperti Ollama atau LM Studio tidak memerlukan kunci sungguhan — tetapi
brankas tetap mewajibkan kolom `GENERIC_API_KEY` diisi (tidak boleh kosong),
jadi simpan saja placeholder apa pun (mis. `local`) untuk memenuhinya.

## Menambahkan kunci ke brankas kredensial

Kredensial penyedia disimpan dalam **brankas kredensial** terenkripsi, bukan
dalam konfigurasi biasa. Anda membuka kuncinya sekali per sesi dengan kata
sandi.

1. Buka **Konfigurasi Global** dari bilah sisi.
2. Jika Anda belum menyiapkan brankasnya, buat dulu: pilih kata sandi
   brankas (yang akan Anda pakai lagi setiap sesi) lalu buka kuncinya.
3. Di bagian **Aktifkan sebuah modul**, pilih **Generic AI**. Jika kunci
   yang diperlukan belum ada, editor brankas otomatis terbuka pada kunci
   yang tepat — jika tidak, klik **Kelola brankas kredensial**.
4. Di editor brankas, tambahkan kredensial: pilih kunci `GENERIC_API_KEY`,
   masukkan **kata sandi brankas** Anda, lalu klik **Simpan**. Untuk
   endpoint berbayar, tempelkan kunci API sungguhan sebagai nilainya. Untuk
   server lokal yang tidak memerlukan autentikasi, kuncinya opsional — cukup
   simpan placeholder apa pun yang tidak kosong (mis. `local`).

## Menjalankan lebih dari satu endpoint dengan instans

Generic AI mendukung **instans bernama**, jadi Anda bisa mendaftarkan
beberapa endpoint (misalnya satu penyedia cloud dan satu server lokal)
berdampingan. Gunakan **Tambahkan instans {{name}} lagi…** di Konfigurasi
Global. Setiap instans mendapat kunci brankas turunannya sendiri — misalnya
`GENERIC_API_KEY__MY-OLLAMA` — yang Anda isi di editor brankas yang sama.

## Memilih endpoint dan model

Atur base URL dan model untuk modul (atau tiap instans) di pengaturan
Konfigurasi Global-nya, lalu pilih model per proyek di tab **Konfigurasi**.
**Aturan penyaluran** di tab Penyaluran menentukan modul atau instans mana
yang menangani tiap bahasa.

## Mendapatkan kredensial

Untuk **server lokal** (Ollama, LM Studio, vLLM), tidak perlu akun atau
kunci — cukup base URL-nya (mis. `http://localhost:11434/v1`) dan
placeholder di kolom `GENERIC_API_KEY`.

Untuk **penyedia berbayar**, langkahnya bergantung pada penyedianya: buat
akun, dapatkan base URL API dan kuncinya, lalu pastikan endpoint tersebut
memakai format chat-completions OpenAI sebelum memasukkan kuncinya ke
brankas.
