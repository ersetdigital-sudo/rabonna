import { NextResponse, type NextRequest } from "next/server";

/**
 * Root middleware — sengaja SELF-CONTAINED (tanpa import alias `@/...`).
 *
 * Kenapa: middleware di-deploy sebagai berkas tersendiri, dan pada build
 * production berkas itu bisa di-emit mentah. Kalau dia mengimpor `@/lib/...`
 * (alias tsconfig), Node tidak bisa me-resolve-nya dan semua request gagal
 * dengan MIDDLEWARE_INVOCATION_FAILED. Karena itu hanya paket npm biasa
 * (`next/server`) yang diimpor di sini.
 *
 * Isinya sekarang DUA hal:
 *   1. Menitipkan pathname ke header `x-pathname`, yang dipakai
 *      app/pesanan/layout.tsx untuk tahu halaman mana yang sedang dibuka
 *      (`/pesanan/login` tidak boleh kena cek cookie).
 *   2. Mengalihkan crawler preview link ke app/link-preview — lihat komentar
 *      di bawah.
 *
 * DULU berkas ini juga menyegarkan sesi Supabase lewat `supabase.auth.getUser()`
 * untuk SETIAP request. Dua alasan kenapa itu dihapus:
 *   1. Aplikasi ini tidak punya Supabase Auth sama sekali — login dashboard
 *      memakai shared password + cookie `pesanan_auth` (app/api/pesanan/auth),
 *      dan tidak ada halaman /admin. Jadi panggilan itu hasilnya tidak pernah
 *      dipakai, tapi biayanya nyata: satu round trip HTTP ke Supabase sebelum
 *      request dilanjutkan. Itu yang bikin halaman publik seperti /status dan
 *      /track terasa lambat.
 *   2. `matcher` di bawah juga dipersempit ke rute dashboard, jadi halaman
 *      publik & endpoint API tidak lagi melewati middleware sama sekali.
 *
 * Penjagaan dashboard yang sebenarnya ada di app/pesanan/layout.tsx (cookie
 * `pesanan_auth`) dan lib/admin-auth.ts untuk route handler.
 */

/**
 * Nama crawler preview link yang sudah dikenal.
 *
 * WhatsApp menandai request-nya `WhatsApp/2.x.x.x A|I|N` (A=Android, I=iOS,
 * N=web), tapi Meta juga punya crawler lain — `meta-externalagent` di antaranya —
 * dan crawler baru akan terus muncul.
 */
const KNOWN_CRAWLER =
  /whatsapp|facebookexternalhit|facebot|meta-external\w*|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|pinterest|embedly|skypeuripreview|discord|line-poker|kakaotalk/i;

/**
 * True kalau request ini datang dari crawler preview link, bukan dari orang.
 *
 * Dua lapis, dan lapis kedua itu yang penting:
 *
 *   1. Nama yang dikenal di atas.
 *   2. Apa pun yang TIDAK mengaku sebagai browser. Browser sungguhan selalu
 *      mengirim `Mozilla/…` di User-Agent-nya, sedangkan bot hampir tidak
 *      pernah. Daftar nama saja selalu ketinggalan — WhatsApp pernah berpindah
 *      User-Agent, dan waktu itu preview-nya sempat kembali menampilkan logo
 *      besar karena request-nya lolos sebagai "browser biasa".
 */
function isLinkPreviewCrawler(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent") ?? "";

  // Tanpa User-Agent sama sekali: tidak ada browser yang begitu.
  if (!userAgent) return true;
  if (KNOWN_CRAWLER.test(userAgent)) return true;

  return !/mozilla/i.test(userAgent);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Crawler preview SELALU dapat dokumen TANPA GAMBAR SAMA SEKALI
  // (app/link-preview), untuk SEMUA rute yang cocok — bukan cuma /status dan
  // /track.
  //
  // Kenapa seluas itu: preview WhatsApp tidak hanya muncul untuk link yang
  // dikirim ke customer. Notifikasi deadline ke admin juga berisi link
  // (`…/pesanan/orders`), dan crawler WhatsApp mengikutinya sampai halaman
  // login — yang memasang logo. Logo itu pula yang muncul di chat admin.
  // Halaman mana pun bisa jadi tujuan redirect (mis. /pesanan/* → /login), jadi
  // menyaring per halaman selalu ada yang bocor. Memberi crawler dokumen yang
  // memang tidak punya gambar apa pun menutup semua jalur itu sekaligus.
  //
  // Halaman /status tidak punya og:image, dan WhatsApp memang dirancang
  // "mencari markah lain" saat og:image kosong — jadi ia mengambil ikon situs
  // dan memperbesarnya jadi thumbnail. Menghapus ikon satu per satu tidak
  // menyelesaikan masalah: WhatsApp jatuh ke markah berikutnya.
  if (isLinkPreviewCrawler(request)) {
    // User-Agent sengaja dicatat: kalau preview di WhatsApp masih salah, baris
    // ini di Vercel Logs menunjukkan crawler mana yang datang dan apa yang
    // dimintanya, tanpa perlu menebak lagi.
    console.log(
      `[link-preview] ${pathname} | ua=${(request.headers.get("user-agent") ?? "").slice(0, 140)}`
    );

    const preview = request.nextUrl.clone();
    preview.pathname = "/link-preview";
    preview.search = "";

    const orderNumber = request.nextUrl.searchParams.get("order");
    if (orderNumber) preview.searchParams.set("order", orderNumber);

    return NextResponse.rewrite(preview);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  /*
   * Hanya rute yang benar-benar butuh: dashboard (header `x-pathname`) dan
   * halaman yang link-nya dikirim ke customer lewat WhatsApp (`/status`,
   * `/track`) untuk pengalihan crawler preview.
   *
   * Sengaja BUKAN seluruh situs: middleware berjalan sebelum setiap request,
   * dan endpoint API serta aset statis tidak butuh keduanya.
   */
  matcher: [
    "/",
    "/login",
    "/pesanan/:path*",
    "/status/:path*",
    "/track/:path*",
  ],
};
