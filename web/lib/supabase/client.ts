import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type BrowserClient = SupabaseClient<unknown, string, unknown>;

/**
 * Creates a Supabase browser client using the anon key.
 * Only include this in Client Components.
 */
export function createBrowserClient(): BrowserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing `NEXT_PUBLIC_SUPABASE_URL` environment variable.");
  }

  if (!anonKey) {
    throw new Error("Missing `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
    },
  });
}
