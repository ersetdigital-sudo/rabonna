-- ============================================================================
-- Rabona — 0008 bolehkan kirim ulang notifikasi tahap yang GAGAL
-- ============================================================================
-- BUG PRODUKSI yang diperbaiki di sini.
--
-- `claim_stage_notification` (0004) dan `claim_maklon_stage_notification` (0002)
-- mengandalkan `UNIQUE (order_id, stage)`: baris pertama menang, panggilan
-- berikutnya dapat NULL alias "sudah pernah dikirim". Masalahnya, klaim itu
-- TIDAK membedakan baris yang `success` dari yang `failed`:
--
--   * kegagalan kirim (token invalid, device Fonnte belum tersambung, timeout)
--     meninggalkan baris berstatus `failed`
--   * karena barisnya sudah ada, tahap itu TIDAK PERNAH bisa dikirim ulang —
--     walaupun tokennya sudah diperbaiki
--   * satu-satunya jalan adalah memindahkan tahap bolak-balik ke nomor lain
--
-- Bukti di produksi sebelum perbaikan ini:
--   stage_notification_logs → 1 baris status 'failed'
--   response_payload        → {"error":"fonnte_token_not_set"}
--
-- Perbaikan: klaim tetap menang untuk baris `success`/`pending` (anti-duplikat
-- tidak berubah), tapi baris `failed` boleh diklaim ulang.
--
-- Tidak ada perubahan kode aplikasi: lib/fonnte.ts memanggil RPC ini lewat nama.
-- Idempotent: aman dijalankan berulang.
-- ============================================================================

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
  -- Barisnya sudah ada. Kirim ulang hanya boleh kalau pengiriman sebelumnya
  -- gagal; kalau sudah success/pending, anggap duplikat (return NULL).
  update stage_notification_logs
  set status           = 'pending',
      response_payload = null,
      sent_at          = now()
  where order_id = p_order_id
    and stage = p_stage
    and status = 'failed'
  returning id into v_id;

  return v_id;
end;
$$;

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
  update maklon_notification_logs
  set status           = 'pending',
      response_payload = null,
      sent_at          = now()
  where order_id = p_order_id
    and stage = p_stage
    and status = 'failed'
  returning id into v_id;

  return v_id;
end;
$$;

-- Hak akses tidak berubah (lihat 0002/0004): hanya service_role.
revoke all on function public.claim_stage_notification(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.claim_maklon_stage_notification(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_stage_notification(uuid, integer) to service_role;
grant execute on function public.claim_maklon_stage_notification(uuid, integer) to service_role;

-- VERIFIKASI (jalankan manual di SQL Editor).
-- 1) Tahap yang gagal harus bisa diklaim ulang (hasil bukan NULL):
--   select public.claim_stage_notification(
--     (select order_id from public.stage_notification_logs
--       where status = 'failed' limit 1), 5);
-- 2) Tahap yang sukses harus tetap ditolak (hasil NULL):
--   select public.claim_stage_notification(
--     (select order_id from public.stage_notification_logs
--       where status = 'success' limit 1), 1);
