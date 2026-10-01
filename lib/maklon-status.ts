/**
 * Satu sumber kebenaran untuk alur produksi MAKLON (6 tahap).
 *
 * Sebelumnya daftar 6 tahap ini ditulis di tiga tempat dengan bentuk berbeda:
 *   * app/api/pesanan/maklon/route.ts        → MAKLON_STATUS_LIST + progress
 *   * app/api/pesanan/maklon/[id]/status/route.ts → STATUS_FROM_STEP
 *   * lib/fonnte.ts                          → MAKLON_STAGE_NAMES (label WA)
 * Akibatnya, menambah/mengganti satu tahap berarti memburu tiga file, dan
 * salah satu salinan pasti ketinggalan. Sekarang semuanya menurun dari
 * `MAKLON_STAGES` di bawah — tambah tahap = tambah satu baris di sini.
 *
 * Catatan: `maklon_steps` di database hanya menyimpan NAMA tahap untuk
 * ditampilkan di halaman /status/maklon; urutan logikanya tetap dari sini
 * (lihat migrasi 0003_baseline_seed.sql).
 */

export type MaklonStatus =
  | "layout"
  | "profing_warna"
  | "cutting_bahan"
  | "press_sublime"
  | "qc"
  | "kirim";

export interface MaklonStage {
  /** Nomor tahap, 1-6. */
  step: number;
  /** Nilai yang disimpan di kolom `maklon_orders.current_status`. */
  status: MaklonStatus;
  /** Nama tahap yang dipakai di pesan WhatsApp dan UI. */
  label: string;
}

export const MAKLON_STAGES: readonly MaklonStage[] = [
  { step: 1, status: "layout", label: "Layout" },
  { step: 2, status: "profing_warna", label: "Profing Warna" },
  { step: 3, status: "cutting_bahan", label: "Cutting Bahan" },
  { step: 4, status: "press_sublime", label: "Press Sublime" },
  { step: 5, status: "qc", label: "QC" },
  { step: 6, status: "kirim", label: "Kirim" },
] as const;

/** Jumlah tahap maklon (6). */
export const MAKLON_TOTAL_STAGES = MAKLON_STAGES.length;

/** Tahap terakhir (6, "Kirim") — tahap yang membuat order tuntas. */
export const MAKLON_FINAL_STEP = MAKLON_TOTAL_STAGES;

/** Nilai `current_status` untuk maklon yang sudah tuntas. */
export const MAKLON_DONE_STATUS = "selesai";

/** Persentase progres tetap per tahap (1-indexed). */
export const MAKLON_STEP_PROGRESS: Record<number, number> = {
  1: 17,
  2: 33,
  3: 50,
  4: 67,
  5: 83,
  6: 100,
};

/** Rapikan nomor tahap ke rentang 1-6 (nilai aneh/NaN → tahap 1). */
export function clampMaklonStep(step: number): number {
  return Math.min(Math.max(Math.round(step) || 1, 1), MAKLON_TOTAL_STAGES);
}

/** Tahap (step, status, label) dari nomor tahap. */
export function maklonStage(step: number): MaklonStage {
  return MAKLON_STAGES[clampMaklonStep(step) - 1] ?? MAKLON_STAGES[0];
}

/** Slug status dari nomor tahap (1-6). */
export function maklonStatusFromStep(step: number): MaklonStatus {
  return maklonStage(step).status;
}

/** Nama tahap dari nomor tahap (1-6). */
export function maklonLabelFromStep(step: number): string {
  return maklonStage(step).label;
}

/**
 * Nomor tahap dari slug status. Status tak dikenal → 1
 * (perilaku lama, aman untuk baris warisan di database).
 */
export function maklonStepFromStatus(status: string | null | undefined): number {
  const slug = String(status ?? "").trim().toLowerCase();
  const found = MAKLON_STAGES.find((s) => s.status === slug);
  return found ? found.step : 1;
}

/** true kalau maklon sudah tuntas. */
export function isMaklonCompleted(status: string | null | undefined): boolean {
  return String(status ?? "").trim().toLowerCase() === MAKLON_DONE_STATUS;
}

/**
 * Persentase progres. Tahap terakhir yang sudah punya nomor resi dianggap 100%.
 */
export function maklonProgress(step: number, hasTracking = false): number {
  const clamped = clampMaklonStep(step);
  if (clamped === MAKLON_FINAL_STEP && hasTracking) return 100;
  return MAKLON_STEP_PROGRESS[clamped] ?? 0;
}
