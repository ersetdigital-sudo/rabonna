/**
 * Rate limiter in-memory sederhana (sliding window) untuk endpoint admin.
 *
 * CATATAN: limiter ini per-instance server (memory lokal). Di Vercel dengan
 * banyak instance, batasnya bukan global — tapi cukup sebagai "basic
 * protection" terhadap spam dari satu sesi/order, sesuai checklist keamanan.
 */

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 2000;

/**
 * Cek apakah request diizinkan. Return false bila melebihi `limit` request
 * dalam `windowMs` untuk `key` yang sama.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }

  hits.push(now);
  buckets.set(key, hits);

  // Cleanup oportunistik supaya map tidak membengkak.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, ts] of buckets) {
      if (ts.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return true;
}