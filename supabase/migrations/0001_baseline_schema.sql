-- ============================================================================
-- Rabona — 0001 baseline skema
-- ============================================================================
-- File ini adalah HASIL SQUASH dari migrasi 0001–0029 (29 file) yang sebelumnya
-- dibangun bertahap. Isinya = keadaan database produksi saat squash dibuat,
-- dicocokkan kolom-per-kolom, tipe-per-tipe, dan nullability-per-kolom terhadap
-- schema live lewat PostgREST OpenAPI.
--
-- CARA PAKAI (bedakan dua jalur):
--
--   Database BARU (fresh install)
--     jalankan berurutan: 0001 → 0002 → 0003.
--
--   Database PRODUKSI (sudah berisi data)
--     JANGAN jalankan file ini. Produksi sudah setara baseline ini, jadi cukup
--     jalankan migrasi yang lebih baru (0004 ke atas). Lihat supabase/README.md.
--
-- Yang dibuang dari skema: seluruh modul landing page + katalog (13 tabel,
-- 3 enum, kolom `brand` yang tidak dipakai, bucket storage `products`). Rabona
-- fokus ke dashboard operasional: pesanan, maklon, dan tracking customer.
--
-- Yang TIDAK dibuat di sini dengan sengaja:
--   * index `idx_orders_order_number` / `idx_maklon_orders_order_number` —
--     duplikat dari index yang sudah disediakan UNIQUE constraint.
--   * fungsi helper `public.drop_policy()` — dulu dipakai migrasi lama untuk
--     bikin operasi DDL idempotent, sekarang tidak ada pemakainya.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- brand — satu baris (id = 1): identitas toko untuk halaman tracking
-- ----------------------------------------------------------------------------
create table if not exists public.brand (
  id              smallint primary key default 1 check (id = 1),
  name            text not null,
  monogram        text not null,
  tagline         text not null,
  description     text not null,
  whatsapp_number text not null,
  logo_path       text not null default '/logo.svg',
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- app_settings — konfigurasi admin (nilai rahasia disimpan sebagai ciphertext)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- orders — pesanan jersey (11 tahap produksi, lihat lib/order-status.ts)
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text unique not null,
  customer_name        text not null,
  customer_phone       text not null,
  product_type         text not null default 'jersey',
  quantity             integer not null default 1,
  sizes                text not null default '',
  custom_name          text not null default '',
  custom_number        text not null default '',
  design_notes         text default '',
  -- Slug dari ORDER_STATUS_LIST, atau 'selesai' untuk order yang sudah tuntas.
  -- Sengaja TANPA default: setiap jalur insert wajib menentukan statusnya.
  current_status       text not null,
  tracking_number      text default '',
  courier              text default '',
  delay_reason         text default '',
  delay_estimated_date text default '',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  customer_city        text default '',
  material             text default '',
  deadline             timestamptz,
  design_photos        jsonb default '[]'::jsonb,
  products             jsonb default '[]'::jsonb,
  -- Nomor tahap aktif (1-11) + tahap terakhir yang notifikasi WA-nya sukses.
  current_stage        integer,
  last_notified_stage  integer,
  -- Admin-only: foto work order, tidak pernah dikirim ke customer.
  wo_photos            jsonb default '[]'::jsonb,
  deadline_notified_at timestamptz
);

create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_orders_current_status on public.orders(current_status);

-- ----------------------------------------------------------------------------
-- order_status_history — riwayat tahap pesanan jersey
-- ----------------------------------------------------------------------------
create table if not exists public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     text not null,
  note       text default '',
  photo_url  text default '',
  created_at timestamptz default now()
);

create index if not exists idx_order_status_history_order_id
  on public.order_status_history(order_id);

-- ----------------------------------------------------------------------------
-- production_steps — daftar nama tahap yang tampil di halaman /status
-- ----------------------------------------------------------------------------
create table if not exists public.production_steps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   integer not null unique,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- notification_logs — riwayat notifikasi DEADLINE (cron), bukan notifikasi tahap.
-- Notifikasi tahap punya tabel sendiri: stage_notification_logs.
-- ----------------------------------------------------------------------------
create table if not exists public.notification_logs (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders(id) on delete set null,
  order_number text,
  phone        text not null,
  status       text not null default 'sent',
  error        text,
  diff_days    integer,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notification_logs_created
  on public.notification_logs(created_at desc);
create index if not exists idx_notification_logs_order
  on public.notification_logs(order_id);

-- ----------------------------------------------------------------------------
-- stage_notification_logs — anti-duplikat notifikasi tahap jersey.
--
-- UNIQUE (order_id, stage) adalah kuncinya: RPC claim_stage_notification
-- menyisipkan baris 'pending' dan mengembalikan NULL bila sudah ada, sehingga
-- request kembar tidak pernah mengirim WhatsApp dua kali — aman dari race
-- condition, bukan cuma dicek di kode aplikasi.
--
-- Dipisahkan dari `notification_logs` karena tabel itu sudah dipakai untuk
-- riwayat notifikasi deadline (kolomnya beda: phone/error/diff_days).
-- ----------------------------------------------------------------------------
create table if not exists public.stage_notification_logs (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  stage            integer not null,
  sent_at          timestamptz default now(),
  status           text not null default 'pending',
  response_payload jsonb,
  constraint stage_notification_logs_order_stage_unique unique (order_id, stage),
  constraint stage_notification_logs_stage_range check (stage between 1 and 11),
  constraint stage_notification_logs_status_check
    check (status in ('pending', 'success', 'failed'))
);

create index if not exists idx_stage_notification_logs_order_id
  on public.stage_notification_logs(order_id);

-- ----------------------------------------------------------------------------
-- maklon_orders — pesanan maklon (6 tahap, lihat lib/maklon-status.ts)
-- ----------------------------------------------------------------------------
create table if not exists public.maklon_orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text unique not null,
  customer_name       text not null,
  customer_phone      text not null,
  customer_city       text default '',
  product_type        text not null default '',
  material            text default '',
  quantity            integer not null default 1,
  sizes               text not null default '',
  design_notes        text default '',
  current_status      text not null default 'layout',
  current_stage       integer not null default 1,
  design_photos       jsonb default '[]'::jsonb,
  wo_photos           jsonb default '[]'::jsonb,
  products            jsonb default '[]'::jsonb,
  tracking_number     text default '',
  courier             text default '',
  deadline            timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  last_notified_stage integer
);

create index if not exists idx_maklon_orders_customer_phone
  on public.maklon_orders(customer_phone);
create index if not exists idx_maklon_orders_current_status
  on public.maklon_orders(current_status);

-- ----------------------------------------------------------------------------
-- maklon_status_history — riwayat tahap pesanan maklon
-- ----------------------------------------------------------------------------
create table if not exists public.maklon_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.maklon_orders(id) on delete cascade,
  status     text not null,
  note       text default '',
  photo_url  text default '',
  created_at timestamptz default now()
);

create index if not exists idx_maklon_status_history_order_id
  on public.maklon_status_history(order_id);

-- ----------------------------------------------------------------------------
-- maklon_steps — daftar nama tahap maklon untuk halaman /status/maklon
-- ----------------------------------------------------------------------------
create table if not exists public.maklon_steps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   integer not null unique,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- maklon_notification_logs — anti-duplikat notifikasi tahap maklon (1-6)
-- ----------------------------------------------------------------------------
create table if not exists public.maklon_notification_logs (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.maklon_orders(id) on delete cascade,
  stage            integer not null,
  sent_at          timestamptz default now(),
  status           text not null default 'pending',
  response_payload jsonb,
  constraint maklon_notification_logs_order_stage_unique unique (order_id, stage),
  constraint maklon_notification_logs_stage_range check (stage between 1 and 6),
  constraint maklon_notification_logs_status_check
    check (status in ('pending', 'success', 'failed'))
);

create index if not exists idx_maklon_notification_logs_order_id
  on public.maklon_notification_logs(order_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Model keamanan: RLS TIDAK dipakai sebagai otorisasi. Seluruh akses tabel
-- operasional lewat service role (lib/supabase/server.ts → createServiceClient),
-- dan otorisasinya diperiksa di route handler (lib/admin-auth.ts → getAdminDb).
--
-- Yang tetap butuh policy hanya tabel yang dibaca tanpa login:
--   * brand           → halaman tracking menampilkan nama toko + WA CS
--   * production_steps / maklon_steps → halaman /status menampilkan nama tahap
--
-- PENTING: JANGAN pakai `FORCE ROW LEVEL SECURITY` di tabel mana pun. FORCE
-- membuat RLS berlaku untuk pemilik tabel juga, sehingga service role ikut
-- terblokir dan seluruh dashboard berhenti.
-- ============================================================================

alter table public.brand                   enable row level security;
alter table public.app_settings            enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_status_history    enable row level security;
alter table public.production_steps        enable row level security;
alter table public.notification_logs       enable row level security;
alter table public.stage_notification_logs enable row level security;
alter table public.maklon_orders           enable row level security;
alter table public.maklon_status_history   enable row level security;
alter table public.maklon_steps            enable row level security;
alter table public.maklon_notification_logs enable row level security;

-- brand: boleh dibaca siapa pun (tanpa login), ditulis hanya lewat service role.
create policy "brand_public_read" on public.brand
  for select to anon, authenticated using (true);
create policy "brand_auth_insert" on public.brand
  for insert to authenticated with check (true);
create policy "brand_auth_update" on public.brand
  for update to authenticated using (true) with check (true);
create policy "brand_auth_delete" on public.brand
  for delete to authenticated using (true);

-- Daftar tahap: baca publik, tulis hanya lewat service role.
create policy "Public read production_steps" on public.production_steps
  for select using (true);
create policy "Public read maklon_steps" on public.maklon_steps
  for select using (true);
