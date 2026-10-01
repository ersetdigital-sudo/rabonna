/**
 * Type definitions — identitas toko dan alur produksi.
 *
 * Dua layer untuk `brand` dipertahankan dengan sengaja:
 *
 * 1. `DbBrand` — bentuk baris mentah dari Supabase (snake_case).
 * 2. `Brand` — bentuk yang dikonsumsi komponen (camelCase).
 *
 * lib/queries.ts yang menjembatani keduanya, jadi database tidak pernah tahu
 * soal React, dan komponen tidak pernah tahu soal nama kolom.
 *
 * Tipe untuk modul landing page/katalog sudah dihapus bersama tabelnya
 * (lihat migrasi 0029).
 */

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------
export interface Brand {
  name: string;
  monogram: string;
  tagline: string;
  description: string;
  whatsappNumber: string;
  logoPath: string;
}

export interface DbBrand {
  name: string;
  monogram: string;
  tagline: string;
  description: string;
  whatsapp_number: string;
  logo_path: string;
}

// ---------------------------------------------------------------------------
// Orders Tracking — 11 tahap produksi
// ---------------------------------------------------------------------------
export type OrderStatus =
  | "desain"
  | "layout"
  | "profing_warna"
  | "cetak_print"
  | "press_transfer"
  | "potong_pola"
  | "jahit"
  | "finishing"
  | "quality_control"
  | "packing"
  | "kirim"
  | "selesai";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  desain: "Desain",
  layout: "Layout",
  profing_warna: "Profing Warna",
  cetak_print: "Cetak / Print",
  press_transfer: "Press / Transfer Sublime",
  potong_pola: "Potong Pola / Cutting Panel",
  jahit: "Jahit / Sewing",
  finishing: "Finishing",
  quality_control: "Quality Control",
  packing: "Packing",
  kirim: "Kirim",
  selesai: "Selesai",
};

export const ORDER_STATUS_LIST: OrderStatus[] = [
  "desain",
  "layout",
  "profing_warna",
  "cetak_print",
  "press_transfer",
  "potong_pola",
  "jahit",
  "finishing",
  "quality_control",
  "packing",
  "kirim",
];

/** Fixed progress percentage for each step (1-indexed) */
export const STEP_PROGRESS: Record<number, number> = {
  1: 9,
  2: 18,
  3: 27,
  4: 36,
  5: 45,
  6: 55,
  7: 64,
  8: 73,
  9: 82,
  10: 91,
  11: 100,
};

export function getProgress(step: number, hasTracking: boolean): number {
  if (step === 11 && hasTracking) return 100;
  return STEP_PROGRESS[step] ?? 0;
}

export const ORDER_PHOTO_STAGES: OrderStatus[] = [
  "desain",
  "potong_pola",
  "finishing",
  "packing",
];

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  product_type: string;
  quantity: number;
  sizes: string;
  custom_name: string;
  custom_number: string;
  design_notes: string;
  current_status: OrderStatus;
  /** Nomor tahap produksi aktif (1-11). Label tahap ada di `stageLabel()`
   *  (lib/order-status.ts), yang menurun dari ORDER_STATUS_LIST di atas. */
  current_stage?: number | null;
  /** Tahap terakhir yang notifikasi WA-nya berhasil terkirim. */
  last_notified_stage?: number | null;
  tracking_number: string;
  courier: string;
  deadline: string | null;
  /** Admin-only: Work Order photo URLs (never exposed to customer) */
  wo_photos?: string[];
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  photo_url: string;
  created_at: string;
}
