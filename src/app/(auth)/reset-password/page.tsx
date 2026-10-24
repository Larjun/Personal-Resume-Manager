import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password · Resume Manager" };

// Reached from a recovery email via /auth/confirm, which signs the user in first.
// Not a public path: without a session the proxy sends visitors to /login.
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Set a new password</h1>
      <ResetPasswordForm />
    </>
  );
}
