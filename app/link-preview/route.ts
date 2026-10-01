import { getAppUrl } from "@/lib/app-url";
import { getBrand } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Dokumen yang HANYA disajikan ke crawler preview link (WhatsApp, Telegram,
 * Slack, dan sejenisnya) — lihat middleware.ts.
 *
 * Kenapa ini ada: notifikasi WhatsApp berisi link halaman /status, dan WhatsApp
 * menyusun preview dari halaman itu. Halaman tracking tidak punya og:image, dan
 * WhatsApp memang dirancang untuk "mencari markah lain" kalau og:image kosong —
 * jadi ia mengambil ikon situs dan menampilkannya sebagai kotak besar. Hasilnya
 * logo Rabona raksasa di chat customer.
 *
 * Menghapus sumber gambar satu per satu terbukti tidak menyelesaikan masalah:
 * begitu satu dihapus, WhatsApp jatuh ke markah berikutnya (apple-touch-icon,
 * lalu favicon, lalu gambar di body). Karena itu halaman ini dibuat memang
 * TIDAK punya satu pun gambar — tanpa og:image, tanpa <link rel="icon">, tanpa
 * <img> — sehingga preview-nya hanya teks: judul, deskripsi, dan domain.
 *
 * Untuk pengunjung sungguhan halaman ini tidak pernah dipakai; browser selalu
 * mendapat halaman normal. Meta mendukung cara ini secara resmi: request dari
 * WhatsApp ditandai User-Agent `WhatsApp/2.x.x.x`, dan pemilik situs dinyatakan
 * boleh menyesuaikan isi yang dikirim ke crawler.
 */

/** Escape teks sebelum disisipkan ke HTML — nama toko & nomor pesanan ikut dari luar. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const orderNumber = (params.get("order") || "").trim().toUpperCase();

  const brand = await getBrand();

  const title = orderNumber
    ? `Status Pesanan ${orderNumber}`
    : `Status Pesanan ${brand.name}`;
  const description = `Pantau progres produksi pesanan jersey custom ${brand.name}.`;

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:site_name" content="${escapeHtml(brand.name)}"/>
<meta property="og:url" content="${escapeHtml(`${getAppUrl()}/status`)}"/>
<meta property="og:type" content="website"/>
<meta name="robots" content="noindex,nofollow"/>
</head>
<body></body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Preview chat menempel ke URL, jadi jangan sampai arahkan cache di
      // antara: dokumen ini harus selalu menggambarkan kondisi terbaru.
      "cache-control": "no-store",
    },
  });
}
