// Scheduled cleanup: expired invoice PDFs, payment proofs on invoices paid
// 90+ days ago, and business-logo files no invoice or profile references
// anymore. All the actual logic lives in Postgres (see migration
// 0013_storage_optimization.sql, function run_storage_maintenance()) --
// this function is just the thing a cron trigger can hit on a schedule,
// since Supabase doesn't offer a pg_cron -> plain-SQL scheduler on every
// plan but does offer Scheduled Edge Functions.
//
// Deploy (you run this yourself -- not done automatically):
//   supabase functions deploy storage-maintenance --no-verify-jwt
//
// This function is called by Supabase's Cron, not a signed-in user, so JWT
// verification is off and a shared secret takes its place instead. Set it
// once as a function secret:
//   supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
//
// The service-role key is deliberately NOT auto-injected into Edge
// Functions (unlike SUPABASE_URL / SUPABASE_ANON_KEY), since this function
// needs to bypass RLS to sweep every user's data:
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service role key>
//
// Then schedule it from the Supabase Dashboard: Edge Functions ->
// storage-maintenance -> Schedule (e.g. daily), with header
//   Authorization: Bearer <the same CRON_SECRET>

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const providedSecret = authHeader.replace(/^Bearer\s+/i, "");

  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("run_storage_maintenance");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, result: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
