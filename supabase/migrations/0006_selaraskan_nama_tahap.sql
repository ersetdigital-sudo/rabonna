-- ============================================================================
-- Rabona — 0006 selaraskan nama tahap produksi jersey
-- ============================================================================
-- BUG yang diperbaiki di sini: halaman tracking customer menampilkan angka
-- tahap yang berbeda dari dashboard admin.
--
-- Sebabnya: `production_steps` masih berisi 9 nama dari pipeline lama
-- (Desain, Layout, Print, Pres, Potong, Jahit, Finishing, Packing, Kirim —
-- di-seed migrasi 0016), sedangkan aplikasi sekarang memakai 11 tahap
-- (lihat ORDER_STATUS_LIST di lib/types.ts).
--
-- Halaman /status dulu mencari nomor tahap dengan mencocokkan NAMA ke daftar
-- itu. Untuk `current_status = 'cetak_print'` namanya cocok dengan "Print" di
-- posisi 3, jadi customer melihat "Tahap 3 / 9" (27%) — padahal di dashboard
-- pesanan yang sama sudah "tahap 4 / 11" (36%).
--
-- Dua hal yang diperbaiki:
--   1. Kode (app/status/page.tsx) sekarang mengambil NOMOR tahap dari model
--      kanonik 11 tahap, bukan dari posisi nama di tabel ini. Tabel ini
--      hanya menentukan LABEL yang ditampilkan.
--   2. Migrasi ini menyelaraskan ISINYA, supaya label, timeline customer,
--      pilihan tahap di dashboard, dan pesan WhatsApp menyebut nama yang sama.
--
-- Catatan: nama di tabel ini bisa diubah admin dari dashboard. Migrasi ini
-- mengembalikannya ke nama kanonik; kalau kamu sudah punya nama sendiri,
-- sesuaikan lagi lewat menu tahap setelah migrasi ini berjalan.
--
-- Idempotent: aman dijalankan ulang.
-- ============================================================================

insert into public.production_steps (name, position) values
  ('Desain',                     1),
  ('Layout',                     2),
  ('Profing Warna',              3),
  ('Cetak / Print',              4),
  ('Press / Transfer Sublime',   5),
  ('Potong Pola / Cutting Panel', 6),
  ('Jahit / Sewing',             7),
  ('Finishing',                  8),
  ('Quality Control',            9),
  ('Packing',                   10),
  ('Kirim',                     11)
on conflict (position) do update set name = excluded.name;

-- Sisa baris dari daftar lama (kalau ada posisi di atas 11).
delete from public.production_steps where position > 11;

-- VERIFIKASI (jalankan manual). Hasilnya harus 11 baris, posisi 1-11:
--   select position, name from public.production_steps order by position;
