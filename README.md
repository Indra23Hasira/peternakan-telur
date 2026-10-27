# Peternakan Telur

Aplikasi pencatatan peternakan ayam petelur: input harian kandang, stok pakan & barang, gudang telur, harga jual per wilayah (dengan approval owner), penjualan & piutang, pengiriman, kas, dan dashboard owner.

Stack: React + Vite, Firebase Auth + Firestore (project `jastip-9cc2a`), deploy otomatis ke GitHub Pages lewat GitHub Actions.

Alamat aplikasi: **https://indra23hasira.github.io/peternakan-telur/**

## Setup pertama kali (sekali saja)

### 1. GitHub
1. Upload seluruh isi folder ini ke repo `peternakan-telur` (Add file → Upload files).
2. Pastikan folder `.github/workflows/deploy-pages.yml` ikut ter-upload. Di Mac, folder yang diawali titik tersembunyi di Finder — tekan `Cmd + Shift + .` untuk menampilkannya sebelum drag. Kalau tetap tidak ikut: Add file → Create new file, nama `.github/workflows/deploy-pages.yml`, lalu tempel isinya.
3. Settings → Pages → Source: **GitHub Actions**.
4. Tab Actions: tunggu workflow "Deploy ke GitHub Pages" hijau.

### 2. Firebase Console (project Jastip)
1. **Authentication → Sign-in method**: Email/Password aktif.
2. **Authentication → Settings → Authorized domains**: pastikan ada `indra23hasira.github.io`.
3. **Firestore Database → Rules**: hapus semua, tempel isi file `firestore.rules`, klik **Publish**.
4. **Authentication → Users → Add user** untuk owner. Disarankan pakai **email asli** (mis. Gmail) supaya fitur *Lupa password* bisa dipakai. Bisa juga email sintetis `indra@usaha.local`.

### 3. Login pertama
1. Buka aplikasi, login dengan email asli tadi (atau username `indra` kalau pakai `@usaha.local`).
2. Muncul layar **Setup awal** → isi nama peternakan → akun ini otomatis jadi **Owner**.

### 4. Menambah admin & petugas kandang
1. Firebase Console → Authentication → Add user: `username@usaha.local` + password.
2. Di aplikasi (owner): **Pengaturan & anggota** → tambah username yang sama + perannya.

## Login & password
- **Username** (mis. `budi`) → otomatis jadi `budi@usaha.local`. Cocok untuk petugas yang tidak punya email.
- **Email asli** (mengandung `@`) → dipakai apa adanya; tombol *Lupa password?* di halaman login mengirim link reset ke email itu.
- Semua orang bisa ganti password sendiri di menu **Akun & password**.
- **Lupa password (akun username)**: Firebase Console → Authentication → Users → hapus user itu → *Add user* lagi dengan email yang **sama persis** + password baru. Peran & data tidak hilang, karena keanggotaan disimpan per email, bukan per ID akun.

## Urutan isi data awal
1. **Kandang & batch**: kandang (A, B) → blok/baris per kandang → batch ayam (blok yang ditempati, tanggal masuk, umur, jumlah awal).
2. **Barang & supplier**: barang pakan (satuan stok `kg`, isi per karung), obat, vaksin, peti; daftar supplier.
3. **Pembelian**: catat stok pakan yang ada sekarang sebagai pembelian (atau lewat stok opname).
4. **Harga jual**: buat wilayah → set harga per wilayah × grade × satuan (peti/kg).
5. **Pelanggan**: nama, wilayah, kontak, termin cash/tempo.
6. **Pengiriman**: daftar armada.
7. **Pengaturan**: kg per peti (default 15), batas sisa hari pakan.

## Hak akses

| Peran | Akses |
|---|---|
| Petugas kandang | Input harian & riwayat produksi (lihat sisa stok pakan tanpa harga) |
| Admin | Semua menu operasional; harga yang diinput admin berstatus *menunggu approval* |
| Owner | Semua, termasuk keuangan/laba, approve harga, pengaturan & anggota |

Hak akses dijaga di server oleh `firestore.rules`, bukan hanya di tampilan.

## Catatan teknis
- Data di `farms/utama/...`. Anggota di `farms/utama/members/{email}` dengan field `role`.
- Stok (telur, pakan/barang, deplesi batch) diperbarui otomatis dalam satu batch tulis bersama transaksinya; edit/hapus transaksi hanya menulis selisihnya.
- Offline: data yang diinput saat tidak ada sinyal tersimpan di HP dan tersinkron otomatis saat online.
- Harga jual di-snapshot ke nota; perubahan harga tidak mengubah nota lama.
