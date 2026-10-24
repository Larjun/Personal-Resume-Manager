"use client";

import { useActionState } from "react";
import { changeEmail, updateDisplayName, type AccountFormState } from "@/server/account-actions";
import type { Account } from "@/server/account";
import { Field, FormError, FormSuccess, QueryError, SubmitButton } from "@/components/auth/FormParts";
import { DeleteAccount } from "./DeleteAccount";
import { PasswordSection } from "./PasswordSection";
import { Section } from "./Section";
import { SignInMethods } from "./SignInMethods";

const initial: AccountFormState = { error: null };

export function AccountSettings({ account }: { account: Account }) {
  return (
    <div className="space-y-6">
      {/* ?error= from /auth/callback after a failed "Connect Google". */}
      <div className="empty:hidden">
        <QueryError />
      </div>
      <ProfileSection displayName={account.displayName} />
      <EmailSection email={account.email} pendingEmail={account.pendingEmail} />
      <SignInMethods account={account} />
      <PasswordSection hasPassword={account.hasPassword} email={account.email} />
      <DeleteAccount email={account.email} />
    </div>
  );
}

function ProfileSection({ displayName }: { displayName: string | null }) {
  const [state, action] = useActionState(updateDisplayName, initial);
  return (
    <Section title="Name" description="Shown in the app. It isn't printed on your resumes.">
      <form action={action} className="space-y-3">
        <Field
          label="Display name"
          name="displayName"
          defaultValue={displayName ?? ""}
          maxLength={100}
          autoComplete="name"
        />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <SubmitButton fullWidth={false} pendingLabel="Saving…">
          Save name
        </SubmitButton>
      </form>
    </Section>
  );
}

function EmailSection({ email, pendingEmail }: { email: string; pendingEmail: string | null }) {
  const [state, action] = useActionState(changeEmail, initial);
  return (
    <Section
      title="Email"
      description={
        <>
          You sign in with <strong className="text-zinc-700">{email}</strong>. The email printed on a resume is edited in
          that resume.
        </>
      }
    >
      {pendingEmail && !state.success && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Waiting for confirmation to change to <strong>{pendingEmail}</strong>. Open the links sent to both addresses.
        </p>
      )}
      <form action={action} className="space-y-3">
        <Field label="New email" name="email" type="email" autoComplete="email" required />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <SubmitButton fullWidth={false} pendingLabel="Sending…">
          Change email
        </SubmitButton>
      </form>
    </Section>
  );
}
