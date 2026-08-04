import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for Client Components. Safe to call per-render — cheap to construct. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
