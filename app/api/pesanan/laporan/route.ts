import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/admin-auth";

/**
 * GET /api/pesanan/laporan
 *
 * Read-only. Mengembalikan waktu penyelesaian tiap order, dipakai halaman
 * Laporan untuk menghitung rata-rata waktu produksi.
 *
 * SENGAJA endpoint terpisah dari /api/pesanan/orders: jalur data dashboard
 * Pesanan — termasuk update tahap yang memicu notifikasi Fonnte dan
 * pengingat deadline — tidak tersentuh sama sekali oleh fitur laporan ini.
 *
 * `order_status_history` menyimpan `order_id` (UUID) sedangkan dashboard
 * memakai `order_number`, jadi hasilnya dipetakan ke order_number di sini.
 */

/**
 * Status yang menandai order sudah tuntas produksinya:
 * - `selesai` — ditulis /api/pesanan/orders/[id]/status saat tahap ke-11.
 * - `kirim`   — ditulis /api/admin/orders/[id]/status (tahap akhir).
 *
 * Baris backfill dari /api/track/ensure-history tidak pernah masuk sini:
 * endpoint itu berhenti lebih awal untuk order yang sudah selesai, dan
 * loop-nya tidak pernah mencapai indeks tahap `kirim`.
 */
const FINAL_STATUSES = ["kirim", "selesai"];

export async function GET() {
  const supabase = await getAdminDb();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [ordersRes, historyRes] = await Promise.all([
    supabase.from("orders").select("id, order_number"),
    supabase
      .from("order_status_history")
      .select("order_id, created_at")
      .in("status", FINAL_STATUSES)
      .order("created_at", { ascending: true }),
  ]);

  if (ordersRes.error) {
    return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
  }
  if (historyRes.error) {
    return NextResponse.json({ error: historyRes.error.message }, { status: 500 });
  }

  const numberById = new Map<string, string>();
  (ordersRes.data ?? []).forEach((o: { id: string; order_number: string }) => {
    numberById.set(o.id, o.order_number);
  });

  // Query sudah diurut naik, jadi entri pertama per order = momen order
  // pertama kali mencapai tahap akhir.
  const completed: Record<string, string> = {};
  (historyRes.data ?? []).forEach((h: { order_id: string; created_at: string }) => {
    const orderNumber = numberById.get(h.order_id);
    if (!orderNumber || completed[orderNumber]) return;
    completed[orderNumber] = h.created_at;
  });

  return NextResponse.json({ completed });
}
