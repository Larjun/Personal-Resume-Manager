import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create account · Resume Manager" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Create an account</h1>
      {/* The Google button reads ?next= (useSearchParams), which needs a Suspense boundary. */}
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
