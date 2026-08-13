# Tab Penyaluran

## Ringkasan

Tab **Penyaluran** menentukan modul dan model mana yang menangani tiap
entri. Tab ini terbuka pada satu pemilih penyedia: pilih sebuah penyedia
dan setiap entri dalam proyek dikirim ke sana. Itu sudah cukup untuk
kebanyakan proyek.

Butuh lebih dari satu tujuan? Alihkan tabnya ke **Lanjutan** dan penyusun
aturan lengkap akan muncul, tempat penyaluran bisa berbeda menurut bahasa
target, kategori, atau panjang entri, dan tempat Anda bisa menyimpan
beberapa **grup aturan** bernama. Tabnya mengingat mana dari kedua mode
yang terakhir Anda pakai. Sebuah proyek yang penyalurannya lebih kaya dari
satu penyedia selalu menampilkan penyusun aturan, mode apa pun yang Anda
pilih — pengaturan yang sudah ada tidak pernah disembunyikan dari Anda.

Bagaimanapun, tab ini hanya menentukan *bagaimana* entri dikirim.
Penerjemahan dimulai dari tab **Terjemahan** atau **Bandingkan**.

## Aturan penyaluran

Aturan berada di tampilan **Lanjutan**. Aturan dievaluasi menurut urutan
prioritas; aturan pertama yang cocok dengan sebuah entri yang menang.
Setiap aturan bisa mencocokkan pada:

* **Sumber** — label sumber/asal entri yang diimpor.
* **Batas panjang entri** — hanya berlaku pada entri pada atau di bawah
  jumlah karakter tertentu.
* **Bahasa target** dan **kategori**.

Untuk entri yang cocok, aturan mengatur **modul** (ditambah penimpaan
opsional **model** dan **upaya penalaran**) plus petunjuk prompt opsional
(karakter, nada, gender, catatan). Tambahkan aturan dengan **Tambah
aturan**; setiap perubahan tersimpan untuk Anda saat Anda membuatnya, jadi
tidak ada tombol **Simpan** yang perlu diingat. Anda bisa menyimpan
beberapa **grup aturan** bernama dan berpindah di antaranya (berpindah
terkunci selama sebuah putaran berlangsung).

## Pengelompokan batch

Tab Penyaluran juga punya kendali **Pengelompokan batch** — bawaan per
proyek yang sama seperti yang ditampilkan di tab Konfigurasi, dengan
sakelar **Abaikan batas ukuran batch** yang sepadan. Ini menjaga entri
yang berkaitan tetap dalam satu permintaan penyedia yang sama di seluruh
putaran penerjemahan, penilaian, dan tinjauan sumber.

## Memulai penerjemahan

1. Pilih entri di tab **Terjemahan** atau **Bandingkan**.
2. Buka dialog **Terjemahkan…** dari sana — dialog ini menawarkan opsi
   terjemahkan ulang, memori, dan pengelompokan per putaran, lalu memulai
   putarannya.
3. Pantau kemajuan, percobaan ulang, dan kegagalan di tab **Aktivitas**.
