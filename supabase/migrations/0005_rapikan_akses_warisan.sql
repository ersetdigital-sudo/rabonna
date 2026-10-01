-- ============================================================================
-- Rabona — 0005 rapikan akses warisan
-- ============================================================================
-- Menutup sisa hak akses yang dibuat sebelum model keamanan sekarang dipakai.
-- Sesudah migrasi ini, aturannya tunggal dan mudah diingat:
--
--   * anon key  → hanya boleh MEMBACA `brand`, `production_steps`,
--                 `maklon_steps` (halaman publik + halaman tracking).
--   * sisanya   → lewat service role, otorisasinya diperiksa di route handler
--                 (lib/admin-auth.ts → getAdminDb()).
--
-- Yang dibersihkan:
--
-- 1. Policy untuk role `authenticated`.
--    Dibuat waktu dashboard masih memakai Supabase Auth ("Admin manage ...",
--    "Admin can manage ..."). Dashboard sekarang memakai shared password +
--    service role, dan tidak ada lagi halaman /admin di aplikasi ini, jadi
--    policy itu tidak punya pemakai — hanya jalan masuk tambahan.
--
-- 2. `grant execute ... to anon` pada RPC.
--    Anon key ada di bundle browser. Selama grant itu terbuka, siapa pun bisa
--    memanggil set_app_setting (menimpa token Fonnte) atau
--    claim_stage_notification dengan stage palsu — dan karena UNIQUE
--    (order_id, stage), klaim palsu itu membuat notifikasi aslinya dianggap
--    duplikat sehingga customer TIDAK PERNAH dapat kabar.
--
-- 3. Fungsi helper `public.drop_policy()` — dipakai migrasi lama untuk DDL
--    idempotent, sekarang tidak ada pemanggilnya.
--
-- 4. Index duplikat: `idx_orders_order_number` dan
--    `idx_maklon_orders_order_number` menyalin index yang sudah dibuat UNIQUE
--    constraint pada kolom yang sama.
--
-- Idempotent: semua `if exists` / `revoke` — aman dijalankan berulang dan
-- aman juga di database baru.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Policy warisan (role authenticated)
-- ----------------------------------------------------------------------------
drop policy if exists "Admin can manage orders" on public.orders;
drop policy if exists "Admin can manage order status history" on public.order_status_history;
drop policy if exists "Admin manage notification_logs" on public.notification_logs;
drop policy if exists "Admin manage app_settings" on public.app_settings;
drop policy if exists "Admin manage maklon_notification_logs" on public.maklon_notification_logs;
drop policy if exists "brand_auth_insert" on public.brand;
drop policy if exists "brand_auth_update" on public.brand;
drop policy if exists "brand_auth_delete" on public.brand;

-- ----------------------------------------------------------------------------
-- 2. RPC: cabut akses anon/authenticated, sisakan service role
-- ----------------------------------------------------------------------------
do $$
declare
  fn text;
  signatures text[] := array[
    'public.get_app_setting_value(text)',
    'public.set_app_setting(text, text)',
    'public.claim_stage_notification(uuid, integer)',
    'public.finish_stage_notification(uuid, text, jsonb)',
    'public.mark_last_notified_stage(uuid, integer)',
    'public.claim_maklon_stage_notification(uuid, integer)',
    'public.finish_maklon_stage_notification(uuid, text, jsonb)',
    'public.mark_maklon_last_notified_stage(uuid, integer)'
  ];
begin
  foreach fn in array signatures loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Helper DDL warisan
-- ----------------------------------------------------------------------------
drop function if exists public.drop_policy(text, text);

-- ----------------------------------------------------------------------------
-- 4. Index duplikat
-- ----------------------------------------------------------------------------
drop index if exists public.idx_orders_order_number;
drop index if exists public.idx_maklon_orders_order_number;

-- VERIFIKASI (jalankan manual):
--   -- harus 0 baris: tidak ada policy untuk role anon/public di tabel operasional
--   select tablename, policyname, roles::text from pg_policies
--   where schemaname = 'public' and 'anon' = any(roles) or 'public' = any(roles);
--
--   -- harus service_role saja:
--   select p.proname, array_to_string(p.proacl, ', ') from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname like '%notification%';
