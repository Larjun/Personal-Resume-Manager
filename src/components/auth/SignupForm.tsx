"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resendConfirmation, signUp, type AuthFormState } from "@/server/auth-actions";
import { Field, FormError, GoogleSignIn, SubmitButton } from "./FormParts";
import { linkClass } from "./styles";

const initial: AuthFormState = { error: null };

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [state, action] = useActionState(signUp, initial);

  if (state.sent) return <CheckEmail email={email} />;

  return (
    <>
      <GoogleSignIn />
      <form action={action} className="space-y-3">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          hint="At least 8 characters."
        />
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
      </p>
    </>
  );
}

function CheckEmail({ email }: { email: string }) {
  const [resent, resend] = useActionState(resendConfirmation, initial);
  return (
    <div className="space-y-4 text-sm text-zinc-700">
      <p>
        We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.
      </p>
      <p className="text-zinc-500">
        If you already have an account with this email, sign in instead, or use “Forgot password?”.
      </p>
      <form action={resend} className="space-y-2">
        <input type="hidden" name="email" value={email} />
        <FormError message={resent.error} />
        {resent.sent && <p className="text-zinc-500">Sent again. It can take a minute to arrive.</p>}
        <SubmitButton variant="secondary" pendingLabel="Sending…">
          Resend email
        </SubmitButton>
      </form>
      <Link href="/login" className={linkClass}>
        Back to sign in
      </Link>
    </div>
  );
}
