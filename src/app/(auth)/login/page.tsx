import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in · Resume Manager" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Sign in</h1>
      {/* useSearchParams (for ?next=) needs a Suspense boundary under cacheComponents. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
