# SIUJIAN — Aplikasi Ujian Online (Pilihan Ganda)

Aplikasi ujian berbasis **Next.js** (App Router) dan **SQLite** (via `better-sqlite3`, tanpa perlu server database terpisah). Dosen bisa membuat ujian, menambahkan soal pilihan ganda secara manual atau otomatis dengan bantuan **OpenAI**, membagikan kode ujian ke mahasiswa, dan melihat rekap nilai. Mahasiswa cukup memasukkan kode ujian + nama + NIM, tanpa perlu membuat akun.

## Fitur

- **Login dosen** dengan sesi tersimpan di cookie (aman, `httpOnly`). Akun dosen pertama dibuat sendiri saat pertama kali membuka aplikasi; akun dosen tambahan hanya bisa ditambahkan oleh dosen yang sudah login (menu "Akun Dosen").
- **Kelola ujian**: buat, edit, atur durasi, acak urutan soal/opsi, izinkan retake, publikasikan/tutup ujian.
- **Bank soal pilihan ganda**: tambah/edit/hapus/urutkan soal secara manual (2–6 opsi per soal).
- **Generate soal dengan AI (OpenAI)**: masukkan topik, jumlah soal, tingkat kesulitan, dan (opsional) materi referensi — AI akan membuatkan draf soal yang bisa ditinjau, diedit, dipilih, lalu disimpan ke bank soal.
- **Ujian mahasiswa tanpa akun**: mahasiswa masuk lewat kode ujian, isi nama + NIM, kerjakan dengan timer otomatis, jawaban tersimpan otomatis (aman dari refresh browser), hasil langsung dihitung saat dikumpulkan.
- **Rekap nilai**: tabel nilai per ujian, detail jawaban per mahasiswa, dan unduh CSV (bisa dibuka di Excel).

## Persyaratan

- Node.js 20 atau lebih baru
- npm

## Instalasi & Menjalankan

```bash
# 1. Masuk ke folder project
cd exam-app

# 2. Install dependencies
npm install

# 3. Salin file konfigurasi environment
cp .env.example .env.local
```

Buka `.env.local` dan isi:

- `SESSION_SECRET` — string acak yang panjang untuk mengamankan sesi login. Bisa dibuat dengan menjalankan `openssl rand -base64 32` di terminal.
- `OPENAI_API_KEY` — API key OpenAI Anda (dari https://platform.openai.com/api-keys), diperlukan **hanya** untuk fitur "Generate Soal dengan AI". Fitur lain tetap berjalan normal tanpa API key ini.

```bash
# 4. Jalankan mode pengembangan
npm run dev
```

Buka http://localhost:3000 di browser. Karena belum ada akun dosen, Anda akan diarahkan untuk membuat **akun dosen pertama**.

Database SQLite akan otomatis dibuat di `data/exam.db` saat pertama kali dijalankan — tidak perlu setup database manual.

## Menjalankan di server / produksi

```bash
npm run build
npm start
```

Aplikasi ini bisa dijalankan di VPS mana pun yang mendukung Node.js (mis. dengan `pm2` agar tetap berjalan), atau di layanan seperti Vercel — dengan catatan: karena memakai SQLite berbasis file, pastikan folder `data/` berada di disk yang persisten (pada platform serverless seperti Vercel, filesystem bersifat sementara sehingga SQLite **tidak cocok**; gunakan VPS/hosting dengan disk persisten, atau Docker container dengan volume).

Cadangkan (backup) database secara berkala dengan menyalin file `data/exam.db`.

## Alur Pemakaian

### Sebagai Dosen

1. Daftar/masuk di `/login` atau `/register`.
2. Di dashboard, klik **"+ Buat Ujian"**, isi judul, deskripsi, dan durasi.
3. Tambahkan soal:
   - **Manual**: tab "Soal" → "+ Tambah Soal" → isi pertanyaan, opsi jawaban, tandai jawaban benar.
   - **AI**: tab "Generate AI" → isi topik, jumlah soal, tingkat kesulitan → "Generate Soal" → tinjau/edit draf → "Simpan Soal Terpilih".
4. Klik **"Publikasikan"** di halaman ujian. Kode ujian (6 karakter) akan aktif dan bisa dibagikan ke mahasiswa (atau salin link langsung dengan tombol "Salin link mahasiswa").
5. Pantau hasil di tab **"Nilai"** — bisa dilihat langsung atau diunduh sebagai CSV.
6. Klik **"Tutup Ujian"** setelah waktu ujian selesai agar mahasiswa tidak bisa mengerjakan lagi.

### Sebagai Mahasiswa

1. Buka halaman utama aplikasi → "Kerjakan Ujian", atau langsung ke `/ujian`.
2. Masukkan kode ujian dari dosen.
3. Isi nama lengkap dan NIM, klik "Mulai Ujian".
4. Jawab soal (jawaban tersimpan otomatis di server setiap kali memilih opsi). Timer berjalan otomatis dan ujian akan otomatis terkumpul saat waktu habis.
5. Klik "Kumpulkan Ujian" untuk mengakhiri lebih awal.

## Troubleshooting

**Error `Cannot find native binding. npm has a bug related to optional dependencies` saat `npm run dev`/`npm run build`.**

Ini adalah bug npm yang cukup umum (lihat [npm/cli#4828](https://github.com/npm/cli/issues/4828)): jika `package-lock.json` sempat dibuat/diinstal di sistem operasi atau arsitektur lain, npm bisa gagal mengambil binary native yang sesuai untuk mesin Anda (dipakai oleh Tailwind CSS v4 dan `better-sqlite3`). Perbaikannya:

```bash
rm -rf node_modules package-lock.json
npm install
```

Di Windows (PowerShell): `Remove-Item -Recurse -Force node_modules, package-lock.json`. Setelah itu jalankan `npm install` lagi lalu `npm run dev` seperti biasa. Project ini sengaja tidak menyertakan `package-lock.json` agar `npm install` pertama kali langsung menyesuaikan dengan platform Anda.

## Struktur Teknis Singkat

- `src/lib/db.ts` — koneksi SQLite + migrasi skema otomatis (tabel dibuat saat aplikasi pertama kali start).
- `src/lib/auth.ts` — hashing password (bcrypt) dan sesi login dosen (JWT di cookie httpOnly).
- `src/lib/openai.ts` — pemanggilan OpenAI untuk generate soal dengan structured output (JSON schema).
- `src/app/api/**` — seluruh REST API (dosen: `/api/exams/**`; mahasiswa: `/api/public/**`).
- `src/app/dashboard/**` — antarmuka dosen.
- `src/app/ujian/**` — antarmuka mahasiswa (tanpa login).

## Keamanan & Catatan

- Password disimpan ter-hash (bcrypt), tidak pernah disimpan dalam bentuk teks biasa.
- Setiap dosen hanya bisa melihat/mengelola ujian miliknya sendiri.
- Mahasiswa diidentifikasi lewat NIM per ujian (bukan akun), jadi pastikan mahasiswa memasukkan NIM dengan benar — NIM dipakai untuk mencegah pengumpulan ganda (kecuali opsi "izinkan retake" diaktifkan).
- Jangan bagikan file `.env.local` atau `data/exam.db` (berisi rahasia sesi dan data nilai mahasiswa).
