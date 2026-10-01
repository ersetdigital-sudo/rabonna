-- ============================================================================
-- Rabona — 0002 baseline fungsi (trigger + RPC)
-- ============================================================================
-- Bagian dari baseline (hasil squash migrasi 0001–0029). Jalankan SETELAH
-- 0001_baseline_schema.sql. Lihat header 0001 untuk aturan jalur fresh install.
--
-- Semua fungsi di sini SECURITY DEFINER dengan `set search_path = public`, dan
-- HANYA boleh dieksekusi service role. Anon key tersedia publik di bundle
-- browser, jadi kalau `anon` masih boleh memanggilnya, siapa pun bisa:
--   * menimpa token Fonnte lewat set_app_setting  → notifikasi customer mati;
--   * memanggil claim_stage_notification dengan stage palsu → UNIQUE
--     (order_id, stage) ikut terpakai, sehingga notifikasi tahap yang asli
--     dianggap duplikat dan TIDAK PERNAH terkirim.
-- Karena itu `grant execute` di bawah hanya untuk service_role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at otomatis
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists brand_touch_updated_at on public.brand;
create trigger brand_touch_updated_at
  before update on public.brand
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- app_settings (token Fonnte) — nilai selalu ciphertext dari sisi server
-- ----------------------------------------------------------------------------
create or replace function public.get_app_setting_value(p_key text)
returns text
language sql
security definer
set search_path = public
as $$
  select value from app_settings where key = p_key;
$$;

create or replace function public.set_app_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key <> 'fonnte_token' then
    raise exception 'key not allowed';
  end if;

  insert into app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------------
-- Notifikasi tahap PESANAN (jersey, 11 tahap)
--
-- claim_*  : klaim slot lewat UNIQUE (order_id, stage). NULL = sudah pernah
--            diproses (request kembar) → pemanggil melewati pengiriman.
-- finish_* : tandai hasil kirim (success/failed) + response_payload.
-- mark_*   : catat tahap terakhir yang notifikasinya sukses.
-- ----------------------------------------------------------------------------
create or replace function public.claim_stage_notification(
  p_order_id uuid,
  p_stage integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_stage not between 1 and 11 then
    raise exception 'stage must be between 1 and 11';
  end if;

  insert into stage_notification_logs (order_id, stage, status)
  values (p_order_id, p_stage, 'pending')
  returning id into v_id;

  return v_id;
exception when unique_violation then
  return null;
end;
$$;

create or replace function public.finish_stage_notification(
  p_id uuid,
  p_status text,
  p_response jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update stage_notification_logs
  set status = p_status,
      response_payload = p_response
  where id = p_id;
$$;

create or replace function public.mark_last_notified_stage(
  p_order_id uuid,
  p_stage integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update orders
  set last_notified_stage = p_stage
  where id = p_order_id;
$$;

-- ----------------------------------------------------------------------------
-- Notifikasi tahap MAKLON (6 tahap)
-- ----------------------------------------------------------------------------
create or replace function public.claim_maklon_stage_notification(
  p_order_id uuid,
  p_stage integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_stage not between 1 and 6 then
    raise exception 'stage must be between 1 and 6';
  end if;

  insert into maklon_notification_logs (order_id, stage, status)
  values (p_order_id, p_stage, 'pending')
  returning id into v_id;

  return v_id;
exception when unique_violation then
  return null;
end;
$$;

create or replace function public.finish_maklon_stage_notification(
  p_id uuid,
  p_status text,
  p_response jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update maklon_notification_logs
  set status = p_status,
      response_payload = p_response
  where id = p_id;
$$;

create or replace function public.mark_maklon_last_notified_stage(
  p_order_id uuid,
  p_stage integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update maklon_orders
  set last_notified_stage = p_stage
  where id = p_order_id;
$$;

-- ----------------------------------------------------------------------------
-- Izinkan HANYA service role. Tanpa `revoke`, Postgres memberi EXECUTE ke
-- PUBLIC secara default — jadi revoke-nya wajib, bukan opsional.
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
