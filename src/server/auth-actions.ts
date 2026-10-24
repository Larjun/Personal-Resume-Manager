"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Auth form actions. Never log passwords, tokens or Supabase error payloads that
// might echo them back.

export type AuthFormState = { error: string | null };

const SignInSchema = z.object({
  email: z.email().max(320),
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
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. Check your inbox for the link." };
    }
    if (error.status === 429) return { error: "Too many attempts. Try again in a few minutes." };
    // Same message for unknown email and wrong password.
    return { error: "Incorrect email or password." };
  }
  redirect(safeNextPath(parsed.data.next));
}

/** Idempotent: safe to call with no session (double click, stale tab). Signs out this browser only. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
