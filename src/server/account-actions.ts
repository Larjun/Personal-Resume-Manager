"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DISPLAY_NAME_MAX, ensureProfile, getAccount } from "./account";
import { requireAuthUser } from "./auth";
import { authErrorMessage, logAuthError, type AuthAction } from "./auth-errors";
import { requestOrigin } from "./origin";

// Account settings mutations. Every action starts from the signed-in user
// (requireAuthUser) and only ever changes that user. Errors go through
// ./auth-errors, which never logs form data.

export type AccountFormState = {
  error: string | null;
  success?: string;
  /** Set-password flow: the 6-digit code has been sent, so show the code + password step. */
  codeSent?: boolean;
};

const fail = (action: AuthAction, error: unknown): AccountFormState => ({ error: authErrorMessage(action, error) });

const NewPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

const NewPasswordPairSchema = z
  .object({ password: NewPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The new passwords don't match.", path: ["confirm"] });

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Check the form and try again.";

// ── Display name ─────────────────────────────────────────────────────────────

const DisplayNameSchema = z.string().trim().max(DISPLAY_NAME_MAX, `Use at most ${DISPLAY_NAME_MAX} characters.`);

export async function updateDisplayName(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireAuthUser();
  const parsed = DisplayNameSchema.safeParse(formData.get("displayName") ?? "");
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  await ensureProfile(user);
  await db
    .update(profiles)
    .set({ displayName: parsed.data || null, updatedAt: new Date() })
    .where(eq(profiles.id, user.id));
  revalidatePath("/account");
  return { error: null, success: "Name saved." };
}

// ── Password ─────────────────────────────────────────────────────────────────

/** For accounts that already have a password: checks the current one first. */
export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireAuthUser();
  const current = z.string().min(1).max(256).safeParse(formData.get("current"));
  if (!current.success) return { error: "Enter your current password." };
  const next = NewPasswordPairSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!next.success) return { error: firstIssue(next.error) };

  const supabase = await createSupabaseServerClient();
  // Re-signing in verifies the current password and gives a fresh session, which
  // also satisfies Supabase's "Secure password change" recent-login rule.
  const { data, error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: current.data,
  });
  if (verifyError || data.user?.id !== user.id) {
    if (verifyError?.status === 429) return fail("change-password", verifyError);
    if (verifyError) logAuthError("change-password", verifyError);
    return { error: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: next.data.password });
  if (error) return fail("change-password", error);
  // Sign out every other browser/device; this one keeps its session.
  await supabase.auth.signOut({ scope: "others" });
  return { error: null, success: "Password changed. Other devices were signed out." };
}

/** Step 1 for accounts without a password (Google-only): email a 6-digit code. */
export async function sendPasswordCode(): Promise<AccountFormState> {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.reauthenticate();
  if (error) return fail("set-password", error);
  return { error: null, codeSent: true, success: `We emailed a 6-digit code to ${user.email}.` };
}

/** Step 2: set the password, proving it's really you with the emailed code (nonce). */
export async function setPassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  await requireAuthUser();
  const code = z
    .string()
    .trim()
    .regex(/^\d{6}$/)
    .safeParse(formData.get("code"));
  if (!code.success) return { error: "Enter the 6-digit code from the email.", codeSent: true };
  const next = NewPasswordPairSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!next.success) return { error: firstIssue(next.error), codeSent: true };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: next.data.password, nonce: code.data });
  if (error) return { ...fail("set-password", error), codeSent: true };
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account");
  return { error: null, success: "Password set. You can now sign in with your email and password." };
}

// ── Email ────────────────────────────────────────────────────────────────────

const EmailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email());

/**
 * Starts an email change. With "Secure email change" on, Supabase emails a
 * confirmation link to both the current and the new address; the change applies
 * once both are confirmed (links land on /auth/confirm → /account).
 */
export async function changeEmail(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireAuthUser();
  const parsed = EmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (parsed.data === user.email?.toLowerCase()) return { error: "That's already your email." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  if (error) return fail("change-email", error);
  revalidatePath("/account");
  return {
    error: null,
    success: `Check both ${user.email} and ${parsed.data} for confirmation links. Your email changes once both are confirmed.`,
  };
}

// ── Google ───────────────────────────────────────────────────────────────────

/** Links Google to this account. Requires "Manual linking" in Supabase Auth settings. */
export async function connectGoogle(): Promise<void> {
  await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    // /auth/callback sends errors back to /account (not /login) when next=/account.
    options: { redirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent("/account")}` },
  });
  if (error || !data.url) {
    const code = error?.code === "manual_linking_disabled" ? "linking_disabled" : "oauth";
    logAuthError("link-google", error ?? new Error("linkIdentity returned no URL"));
    redirect(`/account?error=${code}`);
  }
  redirect(data.url);
}

export async function disconnectGoogle(): Promise<AccountFormState> {
  await requireAuthUser();
  // Re-check on the server: the button may be stale.
  const account = await getAccount();
  if (!account.canDisconnectGoogle) {
    return { error: "Set a password first, so you can still sign in without Google." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error: listError } = await supabase.auth.getUserIdentities();
  if (listError) return fail("unlink-google", listError);
  const google = data.identities.find((i) => i.provider === "google");
  if (!google) return { error: null, success: "Google is already disconnected." };
  const { error } = await supabase.auth.unlinkIdentity(google);
  if (error) return fail("unlink-google", error);
  revalidatePath("/account");
  return { error: null, success: "Google disconnected." };
}

// ── Delete account ───────────────────────────────────────────────────────────

/**
 * Deletes the Supabase user. Every user-data table references auth.users with
 * ON DELETE CASCADE, so resumes and the profile go with it.
 */
export async function deleteAccount(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireAuthUser();
  const typed = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  if (typed !== user.email?.toLowerCase()) return { error: "Type your email exactly to confirm." };

  const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(user.id);
  if (error) return fail("delete-account", error);

  // The user no longer exists; just clear this browser's auth cookies.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=deleted");
}
