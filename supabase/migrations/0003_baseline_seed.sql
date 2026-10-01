-- ============================================================================
-- Rabona — 0003 baseline seed
-- ============================================================================
-- Bagian dari baseline (hasil squash migrasi 0001–0029). Jalankan SETELAH 0002.
-- Isinya disalin dari baris yang benar-benar ada di database produksi saat
-- squash dibuat, jadi tidak ada tebakan.
--
-- Aman dijalankan ulang (upsert / on conflict). TIDAK ada rahasia di sini —
-- token Fonnte disimpan lewat dashboard (`/api/admin/settings/fonnte`) dalam
-- bentuk ciphertext, bukan di file migrasi.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Identitas toko (satu baris, id = 1)
-- ----------------------------------------------------------------------------
insert into public.brand (id, name, monogram, tagline, description, whatsapp_number, logo_path)
values (
  1,
  'Rabona',
  'Rabona',
  E'Pabrik Jersey Custom Full Printing.\nDesain bebas, harga pabrik, kirim se-Indonesia.',
  'Rabona — pabrik jersey custom full printing. Desain bebas, harga mulai 85rb, kirim se-Indonesia. Konsultasi gratis via WhatsApp.',
  -- Nomor resmi (dulu placeholder 6281234567890; lihat 0007_nomor_wa_resmi.sql)
  '628115491117',
  '/logo-rabonna.png'
)
on conflict (id) do update set
  name            = excluded.name,
  monogram        = excluded.monogram,
  tagline         = excluded.tagline,
  description     = excluded.description,
  whatsapp_number = excluded.whatsapp_number,
  logo_path       = excluded.logo_path;

-- ----------------------------------------------------------------------------
-- Nama tahap pesanan jersey (11 baris) — dipakai halaman /status
--
-- WAJIB 11 baris dan urutannya sama dengan ORDER_STATUS_LIST (lib/types.ts).
-- Halaman /status memakai tabel ini sebagai LABEL; nomor tahapnya dari model
-- kanonik di kode. Kalau isinya kurang/berbeda urutan, timeline customer
-- bisa menunjuk tahap yang salah.
-- ----------------------------------------------------------------------------
insert into public.production_steps (name, position) values
  ('Desain',                      1),
  ('Layout',                      2),
  ('Profing Warna',               3),
  ('Cetak / Print',               4),
  ('Press / Transfer Sublime',    5),
  ('Potong Pola / Cutting Panel', 6),
  ('Jahit / Sewing',              7),
  ('Finishing',                   8),
  ('Quality Control',             9),
  ('Packing',                    10),
  ('Kirim',                      11)
on conflict (position) do update set name = excluded.name;

-- ----------------------------------------------------------------------------
-- Nama tahap maklon (6 baris) — dipakai halaman /status/maklon
-- ----------------------------------------------------------------------------
insert into public.maklon_steps (name, position) values
  ('Layout',        1),
  ('Profing Warna', 2),
  ('Cutting Bahan', 3),
  ('Press Sublime', 4),
  ('QC',            5),
  ('Kirim',         6)
on conflict (position) do update set name = excluded.name;
