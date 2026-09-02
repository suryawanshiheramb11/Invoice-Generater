import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role Supabase client — bypasses RLS entirely. Only ever import this from
 * server-only code (API route handlers, the CLI verification script): the service role
 * key must never reach the browser. Used here solely to read the private
 * `payment-proofs` bucket and write back an OCR verdict; it is not a third-party AI
 * credential, just this project's own Supabase secret (Project Settings -> API).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use the admin client.");
  }
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
