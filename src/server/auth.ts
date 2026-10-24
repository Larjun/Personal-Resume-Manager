import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string };

/**
 * The signed-in, email-verified user for this request, or null.
 *
 * Uses getUser() (a round trip to Supabase Auth) rather than getClaims(), so a
 * deleted or banned account is rejected immediately instead of when its JWT
 * expires. Deduplicated per request with React cache().
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Auth depends on the real request, and supabase-js reads the clock (Date.now)
  // to check token expiry, which cacheComponents forbids during (runtime) prerendering.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.email || !user.email_confirmed_at) return null;
  return { id: user.id, email: user.email };
});

/**
 * The real access gate. Every read function, server action and route handler that
 * touches user data calls this and filters its queries by the returned id.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
