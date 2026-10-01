/**
 * Daftar pilihan produk untuk form Pesanan & Maklon.
 *
 * Produk custom yang ditambahkan admin disimpan di `localStorage`
 * (key `pas_product_options`), jadi daftarnya **per perangkat** — laptop admin
 * bisa punya daftar yang berbeda dari HP admin.
 *
 * Konsekuensinya: nama produk yang sudah tersimpan di sebuah order belum tentu
 * ada di daftar opsi. Kalau itu terjadi, `<select>` tidak punya option yang
 * cocok dan tampil kosong — seolah produknya hilang padahal datanya ada
 * ("pilih apa, yang muncul apa"). Karena itu setiap form WAJIB memakai
 * `mergeProductOptions()` dan menyertakan nama produk order yang sedang dibuka.
 */

/** Opsi bawaan — selalu muncul, walau localStorage kosong atau diblokir browser. */
export const DEFAULT_PRODUCTS = [
  "Atasan Lengan Pendek",
  "Atasan Lengan Panjang",
  "Setelan Lengan Pendek",
  "Setelan Lengan Panjang",
] as const;

/** Key localStorage bersama untuk Pesanan & Maklon. */
export const PRODUCT_STORAGE_KEY = "pas_product_options";

function normalize(names: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const name = (raw || "").trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Produk custom yang pernah ditambahkan di perangkat ini. */
export function loadSavedProducts(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(PRODUCT_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? normalize(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Opsi lengkap untuk satu `<select>`: bawaan + produk custom perangkat ini +
 * `extra` (biasanya nama produk dari order yang sedang dibuka/diedit).
 */
export function mergeProductOptions(
  extra: (string | null | undefined)[] = []
): string[] {
  return normalize([...DEFAULT_PRODUCTS, ...loadSavedProducts(), ...extra]);
}

/**
 * Keluarga produk — istilah baku order jersey: "Setelan" = atasan + celana,
 * "Atasan" = jersey saja.
 *
 * Nama bebas yang tidak menyebut keduanya (mis. nama desain "Jersey Home")
 * TIDAK dipaksa masuk salah satu: mengembalikan `null` supaya total pcs tetap
 * utuh tanpa tebakan yang bisa diam-diam salah.
 *
 * Dipakai laporan Penjualan per Produk di dashboard DAN bagian produk di
 * halaman depan, jadi keduanya tidak bisa ketinggalan saat daftarnya berubah.
 */
export function productFamily(name: string): "Atasan" | "Setelan" | null {
  const n = name.toLowerCase();
  if (n.includes("setelan")) return "Setelan";
  if (n.includes("atasan")) return "Atasan";
  return null;
}

/**
 * Catat produk baru supaya muncul di pengisian berikutnya.
 * Mengembalikan daftar opsi terbaru (bawaan + tersimpan) untuk dipasang ke state.
 */
export function rememberProducts(names: string[]): string[] {
  const merged = normalize([...DEFAULT_PRODUCTS, ...loadSavedProducts(), ...names]);
  try {
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage penuh/diblokir: opsi tetap hidup di state, tidak fatal.
  }
  return merged;
}
