import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuthError } from "@/server/auth-errors";

// Landing route for every Supabase email link (see the email templates in CLAUDE.md):
//   /auth/confirm?token_hash=…&type=email|recovery|email_change&next=/path
// verifyOtp checks the token (single-use, expires per the project's OTP setting)
// and sets the session cookies.

const TYPES = new Set<EmailOtpType>(["email", "signup", "recovery", "email_change"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.has(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const fallback = type === "recovery" ? "/reset-password" : "/";
      redirect(safeNextPath(params.get("next"), fallback));
    }
    logAuthError("email-link", error);
  } else {
    logAuthError("email-link", new Error(`malformed link (type=${type ?? "none"}, token_hash ${tokenHash ? "present" : "missing"})`));
  }

  // Missing, malformed, expired or already-used link.
  redirect(type === "recovery" ? "/forgot-password?error=link_invalid" : "/login?error=link_invalid");
}
