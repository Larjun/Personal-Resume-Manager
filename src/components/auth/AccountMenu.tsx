import Link from "next/link";
import { getSessionUser } from "@/server/auth";
import { signOut } from "@/server/auth-actions";
import { SignOutButton } from "./SignOutButton";

/** Signed-in email, account link and sign-out button. Reads cookies, so render it inside <Suspense>. */
export async function AccountMenu() {
  const user = await getSessionUser();
  if (!user) return null;
  return (
    <form action={signOut} className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">{user.email}</span>
      <Link href="/account" className="text-zinc-700 underline-offset-2 hover:underline">
        Account
      </Link>
      <SignOutButton />
    </form>
  );
}
