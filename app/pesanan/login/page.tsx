import { redirect } from "next/navigation";

/**
 * Rute login lama (`/pesanan/login`).
 *
 * Halaman login sudah pindah ke `/login` supaya URL-nya pendek dan gampang
 * diingat. Berkas ini dipertahankan supaya bookmark dan link yang sudah
 * beredar tetap jalan — jangan dihapus.
 *
 * Catatan: halaman ini masih berada di bawah layout `/pesanan`, jadi
 * app/pesanan/layout.tsx mengecualikannya dari cek cookie. Redirect-nya
 * sendiri harus server-side (bukan useEffect) supaya tidak ada kedipan
 * halaman kosong.
 */
export default function LegacyPesananLoginRedirect() {
  redirect("/login");
}
