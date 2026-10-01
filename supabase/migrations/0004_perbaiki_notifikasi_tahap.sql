-- ============================================================================
-- Rabona — 0004 perbaiki notifikasi tahap pesanan (jersey)
-- ============================================================================
-- BUG PRODUKSI yang diperbaiki di sini.
--
-- Riwayatnya:
--   0019  membuat notification_logs dengan kolom (order_id, stage, status,
--         response_payload) — dipakai anti-duplikat notifikasi tahap.
--   0020  membuat RPC claim_stage_notification() / finish_stage_notification()
--         yang menulis ke tabel itu.
--   0023  DROP notification_logs lalu membuatnya ULANG sebagai riwayat
--         notifikasi DEADLINE (phone, error, diff_days) — kolom `stage` dan
--         `response_payload` hilang.
--   0023+ RPC dari 0020 tetap ada, tapi menunjuk kolom yang sudah tidak ada.
--
-- Akibatnya di produksi (terbukti lewat pemanggilan RPC langsung):
--   claim_stage_notification   → 42703 column "stage" does not exist
--   finish_stage_notification  → 42703 column "response_payload" does not exist
-- Karena triggerStageNotification() berhenti begitu claim gagal, notifikasi
-- WhatsApp TAHAP PESANAN JERSEY tidak pernah terkirim sama sekali.
-- (Maklon tidak terpengaruh — tabelnya terpisah dan utuh.)
--
-- Perbaikan: tabel khusus `stage_notification_logs` + definisi ulang kedua RPC.
-- Tidak ada perubahan kode aplikasi: lib/fonnte.ts memanggil RPC ini berdasarkan
-- nama, jadi cukup definisinya yang dibetulkan.
--
-- Idempotent: aman dijalankan ulang, dan aman pula dijalankan di database baru
-- (di sana tabelnya sudah dibuat oleh 0001_baseline_schema.sql).
-- ============================================================================

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

alter table public.stage_notification_logs enable row level security;

-- Klaim slot notifikasi: NULL = sudah pernah diklaim (request kembar).
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

-- Hanya service role yang boleh memanggil (lihat penjelasan di 0002).
revoke all on function public.claim_stage_notification(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.finish_stage_notification(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_stage_notification(uuid, integer) to service_role;
grant execute on function public.finish_stage_notification(uuid, text, jsonb) to service_role;

-- VERIFIKASI (jalankan manual). Setelah migrasi ini, panggilan di bawah TIDAK
-- boleh lagi mengembalikan 42703:
--   select public.claim_stage_notification(
--     (select id from public.orders limit 1), 1);
