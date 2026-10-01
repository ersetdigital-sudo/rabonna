import { NextResponse } from "next/server";

/**
 * Password dashboard HANYA dari environment — sengaja tidak ada nilai cadangan.
 *
 * Dulu ada nilai cadangan yang ditulis langsung di baris ini, dan itu dua
 * masalah sekaligus: password produksi jadi tertulis di repo (siapa pun yang
 * membaca kode bisa mencobanya), dan mengosongkan env var TIDAK benar-benar
 * menutup akses karena nilai cadangan itu tetap berlaku sebagai pintu belakang.
 */
const AUTH_SECRET = (process.env.PESANAN_PASSWORD || "").trim();

export async function POST(request: Request) {
  if (!AUTH_SECRET) {
    // Gagal-tertutup: lebih baik login ditolak daripada diam-diam memakai
    // password yang ada di kode.
    console.error("[pesanan-auth] ditolak: PESANAN_PASSWORD belum di-set di environment");
    return NextResponse.json(
      { error: "Server belum dikonfigurasi: PESANAN_PASSWORD belum di-set." },
      { status: 500 }
    );
  }

  const { password } = await request.json();

  // Trim dulu: spasi/newline yang kebawa dari autofill atau paste sering bikin gagal.
  const submitted = typeof password === "string" ? password.trim() : "";
  const expected = AUTH_SECRET;

  if (submitted !== expected) {
    // Catat panjangnya saja (bukan isinya) biar gampang diagnosa lewat Vercel logs.
    console.warn("[pesanan-auth] mismatch", {
      receivedLength: submitted.length,
      expectedLength: expected.length,
    });
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pesanan_auth", "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
