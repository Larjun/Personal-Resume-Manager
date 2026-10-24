import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuthError } from "@/server/auth-errors";

// OAuth (Google) return route: /auth/callback?code=…&next=/path
// Exchanges the PKCE code for a session using the verifier cookie set by
// signInWithGoogle, then sends the user on to a same-origin `next`.

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // The user cancelled on Google's consent screen, or the provider returned an error.
  if (params.get("error")) {
    // error_description comes from Google/Supabase, not from the user; safe to log.
    logAuthError("oauth-callback", new Error(`${params.get("error")}: ${params.get("error_description") ?? ""}`));
    redirect(params.get("error") === "access_denied" ? "/login?error=oauth_cancelled" : "/login?error=oauth");
  }

  const code = params.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(safeNextPath(params.get("next")));
    logAuthError("oauth-callback", error);
  } else {
    logAuthError("oauth-callback", new Error("missing ?code"));
  }

  redirect("/login?error=oauth");
}
