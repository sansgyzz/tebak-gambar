# 🎨 Tebak Gambar Online — Multiplayer

Game tebak gambar real-time untuk hingga 10 pemain, berbasis Node.js + Socket.io.

---

## 📁 Struktur File

```
tebak-gambar/
├── server.js        ← logika server & game
├── package.json     ← daftar dependensi
└── public/
    └── index.html   ← tampilan game (client)
```

---

## 🚀 Cara Deploy ke Railway (Gratis, Online)

### Langkah 1 — Buat akun Railway
- Buka https://railway.app
- Klik **Login** → pilih **Login with GitHub**
- Buat akun GitHub jika belum punya (gratis)

### Langkah 2 — Upload kode ke GitHub
1. Buka https://github.com dan buat repository baru, nama bebas (contoh: `tebak-gambar`)
2. Klik **uploading an existing file**
3. Upload semua file:
   - `server.js`
   - `package.json`
   - folder `public/` beserta `index.html` di dalamnya
4. Klik **Commit changes**

### Langkah 3 — Deploy di Railway
1. Buka https://railway.app/dashboard
2. Klik **New Project** → **Deploy from GitHub repo**
3. Pilih repository `tebak-gambar` yang baru kamu buat
4. Railway otomatis mendeteksi Node.js dan mulai deploy
5. Tunggu beberapa menit hingga status berubah menjadi **Active**

### Langkah 4 — Dapatkan URL publik
1. Klik project kamu di Railway
2. Pergi ke tab **Settings** → **Networking**
3. Klik **Generate Domain**
4. Kamu akan mendapat URL seperti: `https://tebak-gambar-xxx.up.railway.app`

### Langkah 5 — Main bersama teman!
- Bagikan URL tersebut ke teman-temanmu
- Buat ruangan → bagikan kode 4 huruf ke teman
- Teman buka URL yang sama → masukkan kode → gabung!

---

## 💻 Cara Jalankan di Laptop (Lokal)

Jika ingin mencoba di komputer sendiri dulu:

```bash
# 1. Pastikan Node.js sudah terinstall
# Download di: https://nodejs.org (pilih LTS)

# 2. Masuk ke folder project
cd tebak-gambar

# 3. Install dependensi
npm install

# 4. Jalankan server
npm start

# 5. Buka browser ke:
# http://localhost:3000
```

Untuk main dengan teman di jaringan WiFi yang sama, teman bisa akses:
`http://[IP-laptopmu]:3000`

---

## 🎮 Cara Main

1. Masukkan nama → klik **Buat Ruangan** atau **Gabung**
2. Bagikan **kode 4 huruf** ke teman
3. Host klik **Mulai Game** setelah semua bergabung
4. Giliran menggambar → gambar kata yang muncul
5. Giliran menebak → ketik jawaban di chat
6. Skor berdasarkan kecepatan menebak & jumlah yang berhasil menebak

---

## ⚙️ Fitur

- ✅ Multiplayer real-time hingga 10 pemain
- ✅ Sistem room dengan kode unik
- ✅ Kanvas gambar sinkron semua pemain
- ✅ Timer 60 detik per ronde
- ✅ Sistem skor otomatis
- ✅ Chat & tebakan real-time
- ✅ Ronde otomatis bergantian drawer
- ✅ Hasil akhir dengan peringkat
