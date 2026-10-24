import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password · Resume Manager" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-6 text-sm text-zinc-500">Enter your account email and we’ll send you a reset link.</p>
      {/* QueryError reads ?error= (useSearchParams), which needs a Suspense boundary. */}
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
