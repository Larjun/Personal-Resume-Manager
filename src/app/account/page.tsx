import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountSettings } from "@/components/account/AccountSettings";
import { getAccount } from "@/server/account";

export const metadata: Metadata = { title: "Account · Resume Manager" };

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Resumes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-zinc-500">
          How you sign in. The name, email, phone and links on a resume are edited in each resume.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading account…</p>}>
        <AccountLoader />
      </Suspense>
    </main>
  );
}

async function AccountLoader() {
  const account = await getAccount();
  return <AccountSettings account={account} />;
}
