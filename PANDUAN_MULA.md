# Panduan mula — GrabStudent

## 1. Buka projek

Extract ZIP ini. Buka folder `GrabStud-main` melalui VS Code. Pastikan Node.js 20 atau lebih baharu dipasang.

## 2. Sediakan tetapan

Salin `.env.example`, kemudian namakan salinan itu `.env.local`.

Untuk cuba demo, ubah `NEXT_PUBLIC_DEMO_MODE` kepada `"true"`.

## 3. Jalankan

Buka Terminal di VS Code, kemudian taip satu persatu:

```bash
npm ci
npm run db:demo
npm run dev
```

Buka http://localhost:3000 melalui browser.

## 4. Akaun demo

| Peranan   | Email                     | Password    |
| --------- | ------------------------- | ----------- |
| Penumpang | passenger@grabstudent.com | Student123! |
| Pemandu   | driver@grabstudent.com    | Student123! |
| Admin     | admin@grabstudent.com     | Admin123!   |

Akaun demo hanya untuk percubaan tempatan. Untuk sistem kosong, jalankan `npm run db:seed` menggantikan `db:demo`.

## 5. Cuba aliran lengkap

1. Daftar pengguna baharu melalui **Join the community**.
2. Pilih Passenger atau Driver. Masukkan nombor telefon dan alamat email biasa. Muat naik ID pelajar; Driver perlu lesen sekali. Gunakan PNG/JPEG/WebP/PDF, maksimum 1.5MB setiap fail.
3. Akaun berada dalam status pending.
4. Log masuk sebagai admin dalam browser lain/incognito. Buka dokumen, kemudian **Approve** atau **Decline**.
5. Pengguna yang diluluskan akan boleh masuk dashboard. Halaman pending menyemak status secara automatik.
6. Penumpang pilih lokasi **PICK-UP**, **DESTINATION**, tarikh/masa dan bayaran tunai atau QR. Klik **Post booking request**.
7. Pemandu buka Driver hub, tapis destinasi melalui **Find passengers**, kemudian pilih penumpang yang mahu diambil.
8. Pemandu isi **Your price (RM)** dan klik **Choose passenger & send price**. Penumpang klik **Agree & book** jika setuju atau **Decline price** jika tidak setuju. Status menjadi **Booked** hanya selepas penumpang bersetuju. Jika harga ditolak, permintaan dibuka semula kepada pemandu lain.
9. Bayaran tunai atau QR dibuat terus kepada pemandu. Sistem ini tidak memproses bayaran online.
10. Pemandu klik **Complete journey** selepas waktu berlepas atau **Cancel booking** sebelum waktu berlepas. Penumpang boleh klik **Cancel request** untuk membatalkan permintaan atau tempahan.

Semua masa dipaparkan mengikut Malaysia. Animasi turut menghormati tetapan reduced motion.

## 6. Publish ke Vercel

Ikut bahagian **Deploy on Vercel** dalam README. Anda perlu database Turso dan AUTH_SECRET sendiri. Fail ZIP ini ialah kod projek lengkap; ia belum diterbitkan sebagai website awam.

Pengguna sedia ada boleh klik **Add phone number** atau **Edit phone number**. Harga laluan ialah cadangan; harga akhir ditetapkan oleh pemandu dan dipersetujui penumpang.
