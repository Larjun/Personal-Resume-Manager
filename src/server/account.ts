import "server-only";
import type { User } from "@supabase/supabase-js";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, type ProfileRow } from "@/db/schema";
import { requireAuthUser } from "./auth";

// Read side of the account page. Mutations live in ./account-actions.ts.
// Account data (sign-in email, display name) is separate from resume data: the
// name, email and links printed on a resume live in each resume's content.header.

export type Account = {
  id: string;
  email: string;
  /** Set while an email change waits for confirmation. */
  pendingEmail: string | null;
  displayName: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  /** Google can be removed only if the account keeps another way to sign in. */
  canDisconnectGoogle: boolean;
};

export const DISPLAY_NAME_MAX = 100;

/** The user's profile row, created on first use (display name prefilled from Google). */
export async function ensureProfile(user: User): Promise<ProfileRow> {
  const meta = user.user_metadata ?? {};
  const fromProvider = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  await db
    .insert(profiles)
    .values({ id: user.id, displayName: fromProvider?.trim().slice(0, DISPLAY_NAME_MAX) ?? null })
    .onConflictDoNothing();
  const [row] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return row;
}

/**
 * Whether the user can sign in with a password. Supabase's API doesn't expose this
 * (a Google user who sets a password gets no "email" identity), so read it from
 * auth.users. Our server connects as postgres, which can read the auth schema.
 * Read-only: never write to auth.* tables; use the Supabase Auth API.
 */
async function userHasPassword(userId: string): Promise<boolean> {
  const rows = await db.execute<{ has_password: boolean }>(
    sql`select coalesce(encrypted_password, '') <> '' as has_password from auth.users where id = ${userId}`,
  );
  return rows[0]?.has_password ?? false;
}

export async function getAccount(): Promise<Account> {
  const user = await requireAuthUser();
  const [profile, hasPassword] = await Promise.all([ensureProfile(user), userHasPassword(user.id)]);
  const identities = user.identities ?? [];
  const hasGoogle = identities.some((i) => i.provider === "google");
  return {
    id: user.id,
    email: user.email!,
    pendingEmail: user.new_email ?? null,
    displayName: profile.displayName,
    hasPassword,
    hasGoogle,
    // Supabase refuses to unlink an account's only identity; we also require a password.
    canDisconnectGoogle: hasGoogle && hasPassword && identities.length >= 2,
  };
}
