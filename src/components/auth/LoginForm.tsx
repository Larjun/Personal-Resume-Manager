"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/server/auth-actions";
import { Field, FormError, GoogleSignIn, QueryError, QueryNotice, SubmitButton } from "./FormParts";
import { linkClass } from "./styles";

const initial: AuthFormState = { error: null };

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action] = useActionState(signIn, initial);

  return (
    <>
      <div className="mb-4 empty:hidden">
        <QueryNotice />
      </div>
      <GoogleSignIn />
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <QueryError />
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
      <div className="mt-6 flex justify-between text-sm text-zinc-500">
        <Link href="/forgot-password" className={linkClass}>
          Forgot password?
        </Link>
        <span>
          New here?{" "}
          <Link href="/signup" className={linkClass}>
            Create an account
          </Link>
        </span>
      </div>
    </>
  );
}
