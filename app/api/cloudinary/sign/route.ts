import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CLOUDINARY_FOLDER } from "@/lib/cloudinary";
import { signCloudinaryUpload } from "@/lib/cloudinary-server";

export const dynamic = "force-dynamic";

/**
 * Tanda tangan unggahan Cloudinary untuk dashboard admin.
 *
 * Preset Cloudinary project ini bertipe SIGNED, jadi browser tidak bisa
 * mengunggah tanpa tanda tangan. Signature (SHA-1 dari parameter + api_secret)
 * dibuat di sini karena hanya server yang boleh memegang api_secret.
 *
 * Digerbangi cookie admin yang sama dengan route dashboard lain: tanpa itu,
 * siapa pun bisa memakai kuota Cloudinary akun ini untuk mengunggah berkasnya
 * sendiri.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("pesanan_auth")?.value !== "true") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `folder` menentukan lokasi aset di Cloudinary dan nilainya ikut
  // ditandatangani. Hanya folder milik aplikasi ini yang boleh dipakai, supaya
  // tanda tangan tidak bisa dipakai menulis ke folder lain di akun yang sama.
  let folder = CLOUDINARY_FOLDER;
  try {
    const body = await request.json();
    if (typeof body?.folder === "string" && body.folder) folder = body.folder;
  } catch {
    // Body kosong/kacau bukan masalah — pakai folder default.
  }

  if (folder !== CLOUDINARY_FOLDER && !folder.startsWith(CLOUDINARY_FOLDER + "/")) {
    return NextResponse.json({ error: "Folder tidak diizinkan" }, { status: 400 });
  }

  const signed = signCloudinaryUpload(folder);
  if (!signed) {
    return NextResponse.json(
      { error: "Cloudinary belum dikonfigurasi" },
      { status: 503 }
    );
  }

  return NextResponse.json(signed);
}
