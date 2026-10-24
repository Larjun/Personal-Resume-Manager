"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/server/auth-actions";
import { Field, FormError, QueryError, SubmitButton } from "./FormParts";
import { linkClass } from "./styles";

const initial: AuthFormState = { error: null };

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);

  if (state.sent) {
    return (
      <div className="space-y-4 text-sm text-zinc-700">
        <p>If an account exists for that email, we sent a link to reset your password. It expires in an hour.</p>
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="space-y-3">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <QueryError />
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-zinc-500">
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </>
  );
}
