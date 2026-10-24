"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage, logAuthError, silentAuthError } from "./auth-errors";
import { requestOrigin } from "./origin";

// Auth form actions. Errors go through ./auth-errors (logs code/status/message only,
// never passwords or tokens). Messages never reveal whether an email has an account.

export type AuthFormState = { error: string | null; sent?: boolean };

const EmailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email());
// Supabase (bcrypt) ignores bytes past 72.
const NewPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

/** Shown after sign-up, resend and forgot-password, whether or not the account exists. */
const CHECK_EMAIL: AuthFormState = { error: null, sent: true };

const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter your email and password." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // invalid_credentials covers both unknown email and wrong password.
  if (error) return { error: authErrorMessage("sign-in", error) };
  redirect(safeNextPath(parsed.data.next));
}

const SignUpSchema = z.object({ email: EmailSchema, password: NewPasswordSchema });

/**
 * Creates an unconfirmed account and emails a confirmation link (Supabase "Confirm
 * email" must be on). For an email that already has an account, Supabase returns
 * a fake success, so the response is the same either way.
 */
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignUpSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((i) => i.path[0] === "password");
    return { error: passwordIssue?.message ?? "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp(parsed.data);
  // Only returned when "Confirm email" is off; keep the response uniform anyway.
  if (error?.code === "user_already_exists") return CHECK_EMAIL;
  if (error) return { error: authErrorMessage("sign-up", error) };
  return CHECK_EMAIL;
}

/** Resends the sign-up confirmation email. Same response whether or not the email exists. */
export async function resendConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data });
  const devError = error ? silentAuthError("resend", error) : null;
  return devError ? { error: devError } : CHECK_EMAIL;
}

/**
 * Emails a password reset link. In production it always returns the same response,
 * including on errors and rate limits, so it can't be used to find out which emails
 * have accounts. (In development the error is shown, to debug email delivery.)
 */
export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data);
  const devError = error ? silentAuthError("forgot-password", error) : null;
  return devError ? { error: devError } : CHECK_EMAIL;
}

const ResetPasswordSchema = z
  .object({ password: NewPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] });

/** Sets a new password for the session created by a recovery link (/auth/confirm). */
export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the new password." };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { error: "This reset link has expired. Request a new one." };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage("reset-password", error) };
  redirect("/");
}

/** Starts Google sign-in. Supabase links it to an existing account with the same verified email. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // PKCE: supabase-js stores the code verifier in a cookie; /auth/callback exchanges the code.
      redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    logAuthError("google", error ?? new Error("signInWithOAuth returned no URL"));
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

/** Idempotent: safe to call with no session (double click, stale tab). Signs out this browser only. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // Still redirect: "no session" is expected here, and the local cookies are cleared either way.
  if (error && error.name !== "AuthSessionMissingError") logAuthError("sign-out", error);
  redirect("/login");
}
