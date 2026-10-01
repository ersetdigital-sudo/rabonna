/**
 * Enkripsi/dekripsi secret yang disimpan di tabel `app_settings`
 * (mis. token Fonnte). Memakai AES-256-GCM bawaan Node.js crypto —
 * tanpa dependency baru. Key diambil dari environment variable
 * `SETTINGS_ENCRYPTION_KEY` dan TIDAK boleh di-hardcode di kode.
 *
 * Format payload: `<iv base64>:<authTag base64>:<ciphertext base64>`
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

/** True saat SETTINGS_ENCRYPTION_KEY tersedia di environment. */
export function encryptionKeyConfigured(): boolean {
  return Boolean(process.env.SETTINGS_ENCRYPTION_KEY);
}

/** Derive 32-byte key dari SETTINGS_ENCRYPTION_KEY (SHA-256). */
function getKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SETTINGS_ENCRYPTION_KEY tidak di-set di environment");
  }
  return createHash("sha256").update(secret).digest();
}

/** Enkripsi plaintext → string `iv:tag:ciphertext` (base64). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Dekripsi payload hasil `encryptSecret`. Lempar error bila key salah/data korup. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Payload terenkripsi tidak valid");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}