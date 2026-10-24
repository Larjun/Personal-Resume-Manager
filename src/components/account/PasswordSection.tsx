"use client";

import { useActionState } from "react";
import { changePassword, sendPasswordCode, setPassword, type AccountFormState } from "@/server/account-actions";
import { Field, FormError, FormSuccess, SubmitButton } from "@/components/auth/FormParts";
import { Section } from "./Section";

const initial: AccountFormState = { error: null };

const newPasswordFields = (
  <>
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
  </>
);

export function PasswordSection({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  return hasPassword ? <ChangePassword /> : <SetPassword email={email} />;
}

function ChangePassword() {
  const [state, action] = useActionState(changePassword, initial);
  return (
    <Section title="Password" description="Changing it signs you out on your other devices.">
      <form action={action} className="space-y-3">
        <Field label="Current password" name="current" type="password" autoComplete="current-password" required />
        {newPasswordFields}
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <SubmitButton fullWidth={false} pendingLabel="Changing…">
          Change password
        </SubmitButton>
      </form>
    </Section>
  );
}

/** Google-only accounts: prove it's you with an emailed code, then choose a password. */
function SetPassword({ email }: { email: string }) {
  const [sent, sendCode] = useActionState(sendPasswordCode, initial);
  const [state, action] = useActionState(setPassword, initial);
  const codeSent = sent.codeSent || state.codeSent;
  const done = Boolean(state.success) && !state.error;

  return (
    <Section
      title="Set a password"
      description={`You sign in with Google. Add a password to also sign in with ${email}.`}
    >
      {done ? (
        <FormSuccess message={state.success} />
      ) : !codeSent ? (
        <form action={sendCode} className="space-y-3">
          <FormError message={sent.error} />
          <SubmitButton fullWidth={false} variant="secondary" pendingLabel="Sending…">
            Email me a code
          </SubmitButton>
        </form>
      ) : (
        <>
          <FormSuccess message={sent.success} />
          <form action={action} className="mt-3 space-y-3">
            <Field
              label="6-digit code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
            />
            {newPasswordFields}
            <FormError message={state.error} />
            <div className="flex items-center gap-3">
              <SubmitButton fullWidth={false} pendingLabel="Saving…">
                Set password
              </SubmitButton>
            </div>
          </form>
          <form action={sendCode} className="mt-2">
            <button type="submit" className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700">
              Send a new code
            </button>
          </form>
        </>
      )}
    </Section>
  );
}
