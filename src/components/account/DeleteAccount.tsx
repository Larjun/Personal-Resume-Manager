"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type AccountFormState } from "@/server/account-actions";
import { Field, FormError, SubmitButton } from "@/components/auth/FormParts";
import { Section } from "./Section";

const initial: AccountFormState = { error: null };

export function DeleteAccount({ email }: { email: string }) {
  const [typed, setTyped] = useState("");
  const [state, action] = useActionState(deleteAccount, initial);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <Section
      title="Delete account"
      tone="danger"
      description="Permanently deletes your account and every resume in it. This can't be undone."
    >
      <form action={action} className="space-y-3">
        <Field
          label={`Type ${email} to confirm`}
          name="confirmEmail"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <FormError message={state.error} />
        <SubmitButton fullWidth={false} variant="danger" disabled={!matches} pendingLabel="Deleting…">
          Delete my account
        </SubmitButton>
      </form>
    </Section>
  );
}
