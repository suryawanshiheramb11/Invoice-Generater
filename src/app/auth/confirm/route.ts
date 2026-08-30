import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link confirmation (signup confirmation, password recovery, etc).
 * Verifying server-side here (instead of relying on Supabase's default
 * `#access_token=...` hash redirect) sets the session cookie before the
 * redirect happens, so protected pages like /dashboard see the user as
 * already logged in on first load instead of bouncing to /login.
 *
 * Requires the Supabase email templates to link here with token_hash + type,
 * e.g. {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
