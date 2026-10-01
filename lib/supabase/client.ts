/**
 * Browser-side Supabase client.
 *
 * Uses `createBrowserClient` from @supabase/ssr — the official Next.js
 * App Router helper. The returned client reads/writes its auth tokens in
 * a cookie handled by the server middleware (see lib/supabase/middleware.ts),
 * so session state stays consistent between server and client.
 *
 * Only import this from Client Components ('use client'). For Server
 * Components / Route Handlers, use `@/lib/supabase/server` instead.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
