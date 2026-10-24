"use client";

import { useActionState } from "react";
import { connectGoogle, disconnectGoogle, type AccountFormState } from "@/server/account-actions";
import type { Account } from "@/server/account";
import { FormError, FormSuccess, SubmitButton } from "@/components/auth/FormParts";
import { Section } from "./Section";

const initial: AccountFormState = { error: null };

export function SignInMethods({ account }: { account: Account }) {
  const [state, disconnect] = useActionState(disconnectGoogle, initial);

  return (
    <Section title="Sign-in methods">
      <ul className="divide-y divide-zinc-100 text-sm">
        <li className="flex items-center justify-between gap-4 py-3 first:pt-0">
          <div>
            <p className="font-medium text-zinc-900">Email and password</p>
            <p className="text-zinc-500">{account.hasPassword ? account.email : "No password set"}</p>
          </div>
          <span className={account.hasPassword ? "text-emerald-700" : "text-zinc-400"}>
            {account.hasPassword ? "On" : "Off"}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4 py-3 last:pb-0">
          <div>
            <p className="font-medium text-zinc-900">Google</p>
            <p className="text-zinc-500">
              {account.hasGoogle
                ? account.canDisconnectGoogle
                  ? "Connected"
                  : "Connected. Set a password before you can disconnect it."
                : "Not connected"}
            </p>
          </div>
          {account.hasGoogle ? (
            <form action={disconnect}>
              <SubmitButton
                fullWidth={false}
                variant="secondary"
                disabled={!account.canDisconnectGoogle}
                pendingLabel="Disconnecting…"
              >
                Disconnect
              </SubmitButton>
            </form>
          ) : (
            <form action={connectGoogle}>
              <SubmitButton fullWidth={false} variant="secondary" pendingLabel="Opening Google…">
                Connect Google
              </SubmitButton>
            </form>
          )}
        </li>
      </ul>
      <div className="mt-3 space-y-1 empty:hidden">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
      </div>
    </Section>
  );
}
