"use client";

import { useActionState } from "react";
import { resetPassword, type AuthFormState } from "@/server/auth-actions";
import { Field, FormError, SubmitButton } from "./FormParts";

const initial: AuthFormState = { error: null };

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="space-y-3">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        hint="At least 8 characters."
      />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <FormError message={state.error} />
      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
    </form>
  );
}
