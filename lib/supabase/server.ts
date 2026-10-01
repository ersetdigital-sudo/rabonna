/**
 * Server-side Supabase client.
 *
 * Uses `createServerClient` from @supabase/ssr with Next.js cookies().
 * Safe to use in Server Components, Route Handlers, and Server Actions.
 *
 * This client is per-request: call `createClient()` inside each function
 * that needs it — do not share across requests.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** True when the Supabase env vars are present. */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** True when the service-role env var is present. */
export function serviceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Service-role client — MENEMBUS RLS. Hanya untuk server; jangan pernah
 * diimpor dari Client Component (`"use client"`), karena kuncinya rahasia.
 *
 * Dipakai semua akses tabel operasional (orders, order_status_history,
 * maklon_orders, maklon_status_history) yang dulu mengandalkan policy anon
 * `USING (true)`. Sejak policy itu ditutup (migrasi 0027), service role
 * adalah satu-satunya jalur yang boleh menyentuh tabel-tabel tersebut.
 *
 * Otorisasi tetap dilakukan di level route handler lewat hasAdminAccess(),
 * jadi client ini tidak boleh dipakai tanpa cek auth lebih dulu.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "createServiceClient: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi"
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
            // See lib/supabase/middleware.ts.
          }
        },
      },
    }
  );
}
