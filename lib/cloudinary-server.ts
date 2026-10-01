/**
 * Cloudinary — operasi sisi server yang butuh tanda tangan.
 *
 * Di-import HANYA dari route handler. API secret tidak boleh sampai ke bundle
 * browser, jadi jangan pernah import berkas ini dari komponen client.
 *
 * Dipakai untuk membuang aset yang sudah tidak dirujuk database: operator
 * mengganti/menghapus foto di dashboard, atau menghapus pesanannya. Tanpa ini,
 * tiap ganti foto menumpuk file yatim dan kredit Cloudinary habis percuma.
 */
import { createHash } from "crypto";
import { CLOUDINARY_FOLDER, cloudinaryPublicId } from "./cloudinary";

/** Parameter bertanda tangan yang dikirim browser ke Cloudinary. */
export interface CloudinaryUploadSignature {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  upload_preset: string | null;
  signature: string;
}

/** True kalau kredensial admin Cloudinary lengkap. */
export function cloudinaryAdminConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Hitung signature Cloudinary: parameter diurutkan alfabetis, disambung
 * `k=v&k=v`, ditambah api_secret di ujung, lalu SHA-1 (hex).
 */
function sign(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

/**
 * Parameter bertanda tangan untuk satu unggahan dari browser.
 *
 * Preset Cloudinary project ini bertipe SIGNED, jadi browser tidak bisa
 * mengunggah sendirian: ia minta tanda tangan ke `POST /api/cloudinary/sign`
 * lebih dulu, lalu mengirim `file` bersama parameter di bawah ini.
 *
 * Yang ditandatangani harus SAMA PERSIS dengan yang dikirim browser — Cloudinary
 * menghitung ulang signature dari parameter yang diterima, jadi menambah atau
 * mengubah satu parameter saja membuat unggahan ditolak "Invalid Signature".
 *
 * `api_key` memang ikut dikirim (bukan rahasia); `api_secret` tidak pernah
 * keluar dari server. Mengembalikan `null` kalau kredensial belum lengkap.
 */
export function signCloudinaryUpload(
  folder: string = CLOUDINARY_FOLDER
): CloudinaryUploadSignature | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
  };

  // Preset juga ikut ditandatangani: kalau dikirim tanpa masuk signature,
  // Cloudinary menolak permintaan bertanda tangan yang punya parameter ekstra.
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (uploadPreset) params.upload_preset = uploadPreset;

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    timestamp,
    folder,
    upload_preset: uploadPreset ?? null,
    signature: sign(params, apiSecret),
  };
}

/**
 * Hapus aset Cloudinary berdasarkan URL yang tersimpan di database.
 *
 * - URL yang bukan milik cloud kita (mis. gambar lama dari instalasi lain)
 *   dilewati, bukan dicoba dihapus.
 * - Kegagalan TIDAK dilempar: menyimpan pesanan tidak boleh gagal hanya karena
 *   Cloudinary bermasalah. Yang gagal cukup dicatat di log server.
 *
 * Mengembalikan jumlah aset yang benar-benar terhapus.
 */
export async function destroyCloudinaryAssets(urls: string[]): Promise<number> {
  if (!cloudinaryAdminConfigured() || urls.length === 0) return 0;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME as string;
  const apiKey = process.env.CLOUDINARY_API_KEY as string;
  const apiSecret = process.env.CLOUDINARY_API_SECRET as string;

  // Dedupe: satu foto bisa muncul di design_photos dan wo_photos sekaligus.
  const ids = Array.from(
    new Set(
      urls
        .map(cloudinaryPublicId)
        .filter((id): id is string => Boolean(id))
    )
  );

  let deleted = 0;

  for (const publicId of ids) {
    // Hanya aset di folder kita. Ini juga mencegah public_id kiriman client
    // yang menunjuk ke aset Cloudinary lain di akun yang sama.
    if (!publicId.startsWith(CLOUDINARY_FOLDER + "/")) {
      console.warn("Cloudinary: lewati hapus di luar folder", publicId);
      continue;
    }

    const params: Record<string, string> = {
      public_id: publicId,
      invalidate: "true",
      timestamp: String(Math.floor(Date.now() / 1000)),
    };

    const body = new URLSearchParams({
      ...params,
      api_key: apiKey,
      signature: sign(params, apiSecret),
    });

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.result === "ok" || data?.result === "not found")) {
        deleted += 1;
      } else {
        console.error("Cloudinary: gagal hapus aset", publicId, data?.error ?? res.status);
      }
    } catch (err) {
      console.error("Cloudinary: error saat hapus aset", publicId, err);
    }
  }

  return deleted;
}
