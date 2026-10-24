"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "@/server/auth-actions";
import { dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "./styles";

const VARIANTS = { primary: primaryButtonClass, secondary: secondaryButtonClass, danger: dangerButtonClass };

/** Submit button that disables itself while its form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  fullWidth = true,
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
  fullWidth?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${VARIANTS[variant]}${fullWidth ? " w-full" : ""}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-700">{label}</span>
      <input {...input} className={inputClass} />
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="status" className="text-sm text-emerald-700">
      {message}
    </p>
  );
}

const QUERY_ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid, expired or already used. Request a new one.",
  oauth: "Google sign-in didn't complete. Try again.",
  oauth_cancelled: "Google sign-in was cancelled.",
  google_in_use: "That Google account is already connected to a different account.",
  linking_disabled: "Connecting Google isn't enabled yet (Supabase: allow manual linking).",
};

const QUERY_NOTICES: Record<string, string> = {
  deleted: "Your account and all of its resumes were deleted.",
};

/** Message for an ?error= code set by /auth/confirm or /auth/callback. Needs <Suspense>. */
export function QueryError() {
  const code = useSearchParams().get("error");
  return <FormError message={code ? (QUERY_ERRORS[code] ?? QUERY_ERRORS.oauth) : null} />;
}

/** Message for a ?notice= code (e.g. after deleting an account). Needs <Suspense>. */
export function QueryNotice() {
  const code = useSearchParams().get("notice");
  return <FormSuccess message={code ? QUERY_NOTICES[code] : null} />;
}

/** "Continue with Google" plus an "or" divider. Needs <Suspense> (reads ?next=). */
export function GoogleSignIn() {
  const next = useSearchParams().get("next") ?? "";
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="secondary" pendingLabel="Opening Google…">
          <span className="inline-flex items-center justify-center gap-2">
            <GoogleMark />
            Continue with Google
          </span>
        </SubmitButton>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
