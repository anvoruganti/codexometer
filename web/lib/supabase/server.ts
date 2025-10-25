import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ServiceRoleClient = SupabaseClient<unknown, string, unknown>;

/**
 * Creates a Supabase client that uses the service role key.
 * Intended for server-only contexts (Route Handlers, Server Actions, Edge Functions).
 */
export function createServiceRoleClient(): ServiceRoleClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing `SUPABASE_URL` environment variable.");
  }

  if (!serviceKey) {
    throw new Error("Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable.");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
