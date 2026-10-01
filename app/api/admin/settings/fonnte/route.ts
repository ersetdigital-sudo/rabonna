import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/admin-auth";
import {
  decryptSecret,
  encryptSecret,
  encryptionKeyConfigured,
} from "@/lib/fonnte-crypto";
import { FONNTE_TOKEN_KEY } from "@/lib/fonnte";

/**
 * GET /api/admin/settings/fonnte — info token (masked, admin only).
 * Response HANYA berisi `hasToken` + `tokenLast4` — token penuh TIDAK PERNAH
 * dikirim ke client/browser.
 */
export async function GET() {
  const supabase = await getAdminDb();

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RPC SECURITY DEFINER. Sejak migrasi 0005 hanya service role yang boleh
  // memanggilnya, karena itu request ini memakai client dari getAdminDb().
  const { data } = await supabase.rpc("get_app_setting_value", {
    p_key: FONNTE_TOKEN_KEY,
  });

  if (!data) {
    return NextResponse.json({
      hasToken: false,
      tokenLast4: null,
      encryptionKeyConfigured: encryptionKeyConfigured(),
    });
  }

  let tokenLast4: string | null = null;
  try {
    tokenLast4 = decryptSecret(String(data)).slice(-4);
  } catch {
    // Key belum di-set atau data korup — jangan bocorkan isi payload.
    tokenLast4 = null;
  }

  return NextResponse.json({
    hasToken: tokenLast4 !== null,
    tokenLast4,
    encryptionKeyConfigured: encryptionKeyConfigured(),
  });
}

/**
 * POST /api/admin/settings/fonnte — simpan token Fonnte (admin only).
 * Token DIENKRIPSI (AES-256-GCM) sebelum masuk DB dan TIDAK PERNAH di-log.
 */
export async function POST(request: NextRequest) {
  const supabase = await getAdminDb();

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!encryptionKeyConfigured()) {
    return NextResponse.json(
      {
        error:
          "SETTINGS_ENCRYPTION_KEY belum di-set di environment server. Tambahkan ke .env.local lalu deploy ulang.",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token) {
    return NextResponse.json(
      { error: "Token tidak boleh kosong" },
      { status: 400 }
    );
  }

  // Enkripsi di server — plaintext token tidak pernah meninggalkan server.
  const encrypted = encryptSecret(token);

  // Lewat RPC SECURITY DEFINER (hanya key fonnte_token yang diizinkan).
  const { error } = await supabase.rpc("set_app_setting", {
    p_key: FONNTE_TOKEN_KEY,
    p_value: encrypted,
  });

  if (error) {
    // Jangan log isi token; cukup message error DB.
    console.error("set_app_setting failed:", error.message);
    return NextResponse.json(
      { error: "Gagal menyimpan pengaturan" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    tokenLast4: token.slice(-4),
  });
}