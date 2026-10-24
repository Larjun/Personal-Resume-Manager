import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuthError } from "@/server/auth-errors";

// OAuth (Google) return route, for both sign-in and "Connect Google" on /account:
//   /auth/callback?code=…&next=/path
// Exchanges the PKCE code for a session using the verifier cookie set by
// signInWithGoogle / connectGoogle, then sends the user on to a same-origin `next`.

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  // Linking starts from the (signed-in) account page, so its errors go back there;
  // /login would just redirect a signed-in user to /.
  const failTo = (code: string) => redirect(`${next === "/account" ? "/account" : "/login"}?error=${code}`);

  // The user cancelled on Google's consent screen, or the provider/Supabase returned an error.
  const providerError = params.get("error");
  if (providerError) {
    // error_description comes from Google/Supabase, not from the user; safe to log.
    const errorCode = params.get("error_code");
    logAuthError("oauth-callback", new Error(`${errorCode ?? providerError}: ${params.get("error_description") ?? ""}`));
    if (errorCode === "identity_already_exists") failTo("google_in_use");
    failTo(providerError === "access_denied" ? "oauth_cancelled" : "oauth");
  }

  const code = params.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    logAuthError("oauth-callback", error);
    if (error.code === "identity_already_exists") failTo("google_in_use");
  } else {
    logAuthError("oauth-callback", new Error("missing ?code"));
  }

  failTo("oauth");
}
