## Telegram Bot Manager & Simple Bot

Aplikasi ini adalah **server bot Telegram berbasis Node.js** dengan dashboard web untuk:

- Menjalankan 1 bot Telegram (token di `bot.js`).
- Menyimpan banyak token bot di database SQLite (`bots.sqlite`).
- Menampilkan daftar semua bot (nama, username, token, status).
- Menampilkan daftar **group** dan **private chat** yang pernah mengirim pesan ke bot runtime.
- Mengirim pesan uji ke Chat ID via halaman dashboard.

> Catatan: Hanya **bot yang token‑nya di `bot.js`** yang benar‑benar berjalan (polling ke Telegram). Bot lain di database hanya sebagai data manajemen.

---

## Prasyarat

- Node.js **v18+** (disarankan).
- Token bot dari **@BotFather**.

---

## Instalasi & Menjalankan Aplikasi

1. Clone / salin repo ini, lalu masuk ke folder:

```bash
git clone <url-repo-anda>
cd telebot
```

2. Install dependency:

```bash
npm install
```

3. Masukkan token bot utama di `bot.js`:

```js
var token = "123456789:ABCDEF_TOKEN_DARI_BOTFATHER";
```

4. Jalankan server:

```bash
npm start
```

Keluaran di terminal akan menampilkan:

- `bot server started...`
- `Bot terhubung sebagai: <nama> (@username)`
- `Web server started at http://localhost:3000`

---

## Fitur Dashboard (`/` – Halaman Utama)

Buka browser ke:

```
http://localhost:3000/
```

Halaman utama menampilkan:

- **Form Tambah Bot (Token saja)**  
  Masukkan token baru → sistem otomatis:

  - Memanggil `getMe` ke Telegram.
  - Mengisi **nama** dan **username** dari data bot.
  - Menyimpan ke tabel `bots` di `bots.sqlite`.
  - Jika token salah → muncul notifikasi **SweetAlert** dan data **tidak disimpan**.

- **Tabel “Semua Bot di Database”**  
  Kolom:

  - ID
  - Nama (klik untuk buka dashboard dengan konteks bot itu)
  - Username
  - Token
  - Dibuat / Update
  - Status (badge “Aktif” dengan animasi)
  - Aksi:
    - ✏ Edit: hanya mengubah **token**, lalu otomatis sinkron nama & username dari Telegram.
    - 🗑 Hapus: menghapus bot dari database (dengan konfirmasi SweetAlert).

- **Ringkasan Endpoint API**  
  Menampilkan URL lengkap untuk:
  - `/api/chats`, `/api/groups`, `/api/private`
  - `/api/send`
  - `/api/bots` (CRUD bot)

---

## Halaman Dashboard (`/dashboard`)

Klik nama bot di tabel atau buka langsung:

`+
http://localhost:3000/dashboard
`

Menampilkan:

- **Informasi Bot Runtime** (berdasarkan token di `bot.js`).
- **Daftar Group**  
  Menampilkan semua chat dengan `type = group/supergroup` atau ID negatif yang pernah mengirim pesan ke bot.
- **Daftar Private Chat**  
  Menampilkan semua chat `type = private`.
- **Form Test Kirim Pesan**
  - Input: `Chat ID` + `Pesan`.
  - Setelah submit:
    - Jika sukses → card hijau “Pesan berhasil dikirim ke chat.”
    - Jika gagal → card merah “Gagal mengirim pesan…”.
  - Halaman tidak berpindah, hanya menampilkan notifikasi di bawah form.
- Tombol **“← Kembali”** untuk kembali ke halaman utama.

> **Catatan penting:**  
> Untuk mencatat group ke “Daftar Group”, pastikan:
>
> - Bot (token di `bot.js`) sudah ditambahkan ke group.
> - Privacy mode di @BotFather untuk bot tersebut **Disable** (via `/setprivacy`).
> - Kirim minimal satu pesan (misalnya `/say_hello tes`) di group setelah bot menyala.

---

## Struktur Proyek Singkat

- `bot.js` – Inisialisasi dan handler bot Telegram (polling).
- `web.js` – Server Express + halaman dashboard + endpoint API.
- `db.js` – Abstraksi akses ke database SQLite (`bots.sqlite`).
- `bots.sqlite` – File database SQLite untuk menyimpan daftar bot.
- `package.json` – Konfigurasi dependensi dan script npm.
- `README.md` – Dokumentasi proyek.

---

## Lisensi

Silakan gunakan dan modifikasi sesuai kebutuhan. Tambahkan lisensi Anda sendiri jika diperlukan.
