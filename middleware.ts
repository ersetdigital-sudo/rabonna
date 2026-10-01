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
 *   2. Mengalihkan crawler preview link ke app/link-preview — lihat
 *      PREVIEW_CRAWLER di bawah.
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
 * User-Agent crawler yang menyusun preview link di aplikasi chat.
 *
 * WhatsApp menandai request-nya dengan `WhatsApp/2.x.x.x A|I|N` (A=Android,
 * I=iOS, N=web). Nama lain ikut dimasukkan karena polanya sama: semuanya
 * mengambil gambar dari halaman dan menampilkannya di chat.
 */
const PREVIEW_CRAWLER =
  /WhatsApp|facebookexternalhit|Facebot|TelegramBot|Twitterbot|Slackbot|Discordbot|LinkedInBot|Pinterest|Embedly|SkypeUriPreview/i;

export function middleware(request: NextRequest) {
  // Crawler preview dapat dokumen tanpa gambar sama sekali (app/link-preview),
  // supaya chat customer tidak lagi menampilkan logo raksasa. Halaman ini tidak
  // punya og:image, jadi kalau crawler dibiarkan membaca halaman normal,
  // WhatsApp jatuh ke ikon situs dan memperbesarnya jadi thumbnail.
  if (PREVIEW_CRAWLER.test(request.headers.get("user-agent") ?? "")) {
    const preview = request.nextUrl.clone();
    preview.pathname = "/link-preview";
    preview.search = "";

    const orderNumber = request.nextUrl.searchParams.get("order");
    if (orderNumber) preview.searchParams.set("order", orderNumber);

    return NextResponse.rewrite(preview);
  }

  const response = NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
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
  matcher: ["/pesanan/:path*", "/status/:path*", "/track/:path*"],
};
