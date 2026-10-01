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
| Penumpang | passenger@grabstudent.edu | Student123! |
| Pemandu   | driver@grabstudent.edu    | Student123! |
| Admin     | admin@grabstudent.edu     | Admin123!   |

Akaun demo hanya untuk percubaan tempatan. Untuk sistem kosong, jalankan `npm run db:seed` menggantikan `db:demo`.

## 5. Cuba aliran lengkap

1. Daftar pengguna baharu melalui **Join the community**.
2. Pilih Passenger atau Driver. Muat naik ID pelajar; Driver perlu lesen sekali. Gunakan PNG/JPEG/WebP/PDF, maksimum 1.5MB setiap fail.
3. Akaun berada dalam status pending.
4. Log masuk sebagai admin dalam browser lain/incognito. Buka dokumen, kemudian **Approve** atau **Decline**.
5. Pengguna yang diluluskan akan boleh masuk dashboard. Halaman pending menyemak status secara automatik.
6. Pemandu pilih laluan, tarikh/masa dan 1–4 tempat duduk. Klik **Publish ride**.
7. Penumpang cari laluan dan klik **Book a seat**.
8. Pemandu klik **Accept**. Tempat duduk berkurang satu; penumpang nampak accepted dalam **My bookings**.
9. Bayaran tunai atau QR dibuat terus kepada pemandu. Sistem ini tidak memproses bayaran online.
10. Pemandu klik **Complete ride** selepas waktu berlepas, atau **Cancel** jika perjalanan dibatalkan. Penumpang boleh batalkan tempahan sebelum berlepas.

Semua masa dipaparkan mengikut Malaysia. Animasi turut menghormati tetapan reduced motion.

## 6. Publish ke Vercel

Ikut bahagian **Deploy on Vercel** dalam README. Anda perlu database Turso dan AUTH_SECRET sendiri. Fail ZIP ini ialah kod projek lengkap; ia belum diterbitkan sebagai website awam.
