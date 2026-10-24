import "server-only";
import { isAuthError, isAuthRetryableFetchError, isAuthWeakPasswordError } from "@supabase/supabase-js";

// One place that turns Supabase Auth errors into (a) a server log line and (b) a
// message for the user. Logs carry only the error's code, status and message,
// never request data, so passwords and tokens can't end up in logs.

export type AuthAction =
  | "sign-in"
  | "sign-up"
  | "resend"
  | "forgot-password"
  | "reset-password"
  | "google"
  | "oauth-callback"
  | "email-link"
  | "sign-out";

const isDev = process.env.NODE_ENV === "development";

export const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";

// Known Supabase error codes → what we tell the user.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email first. Check your inbox for the link, or sign up again to resend it.",
  email_address_invalid: "That email address can't be used. Try a different one.",
  email_address_not_authorized:
    "We can't send email to this address right now. Try again later, or use Continue with Google.",
  signup_disabled: "New sign-ups are turned off right now.",
  email_provider_disabled: "Email sign-in is turned off right now. Use Continue with Google.",
  provider_disabled: "Google sign-in is turned off right now.",
  over_request_rate_limit: TOO_MANY,
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes and try again.",
  same_password: "Choose a password you haven't used here before.",
  session_not_found: "Your session expired. Request a new link.",
  session_expired: "Your session expired. Request a new link.",
  reauthentication_needed: "For security, sign in again before changing your password.",
  otp_expired: "That link has expired. Request a new one.",
  user_banned: "This account can't sign in.",
  request_timeout: "The sign-in service took too long to respond. Try again.",
  hook_timeout: "The sign-in service took too long to respond. Try again.",
};

// Fallbacks when the code is missing or unknown. A 5xx from sign-up, resend or
// forgot-password is almost always Supabase failing to send the email (SMTP).
const FALLBACKS: Record<AuthAction, string> = {
  "sign-in": "Couldn't sign you in. Try again.",
  "sign-up": "Couldn't create the account. Try again.",
  resend: "Couldn't send the email. Try again later.",
  "forgot-password": "Couldn't send the email. Try again later.",
  "reset-password": "Couldn't update the password. Request a new reset link.",
  google: "Couldn't start Google sign-in. Try again.",
  "oauth-callback": "Google sign-in didn't complete. Try again.",
  "email-link": "That link is invalid, expired or already used. Request a new one.",
  "sign-out": "Couldn't sign out. Try again.",
};

const SEND_FAILED = "We couldn't send the email. Try again later.";

function weakPasswordMessage(reasons: readonly string[]): string {
  if (reasons.includes("pwned")) return "That password has appeared in a data breach. Choose a different one.";
  if (reasons.includes("length")) return "Use a longer password.";
  if (reasons.includes("characters")) return "Use a mix of upper- and lowercase letters, numbers and symbols.";
  return "Choose a stronger password.";
}

/** Logs an auth failure without any request data. */
export function logAuthError(action: AuthAction, error: unknown): void {
  if (isAuthError(error)) {
    console.error(`[auth] ${action} failed: ${error.code ?? error.name} (status ${error.status ?? "?"}): ${error.message}`);
  } else {
    console.error(`[auth] ${action} failed:`, error instanceof Error ? `${error.name}: ${error.message}` : error);
  }
}

/** Logs the error and returns the message to show. In development, appends the raw code. */
export function authErrorMessage(action: AuthAction, error: unknown): string {
  logAuthError(action, error);

  let message: string;
  if (isAuthWeakPasswordError(error)) {
    message = weakPasswordMessage(error.reasons);
  } else if (isAuthRetryableFetchError(error)) {
    message = "Can't reach the sign-in service. Check your connection and try again.";
  } else if (isAuthError(error) && error.code && MESSAGES[error.code]) {
    message = MESSAGES[error.code];
  } else if (isAuthError(error) && error.status === 429) {
    message = TOO_MANY;
  } else if (
    isAuthError(error) &&
    (error.status ?? 0) >= 500 &&
    (action === "sign-up" || action === "resend" || action === "forgot-password")
  ) {
    message = SEND_FAILED;
  } else {
    message = FALLBACKS[action];
  }

  return isDev ? `${message} [dev: ${devDetail(error)}]` : message;
}

function devDetail(error: unknown): string {
  if (isAuthError(error)) return `${error.code ?? error.name}, status ${error.status ?? "?"}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/**
 * For actions whose response must not reveal whether an email has an account
 * (resend, forgot password): logs the error, and only in development surfaces it
 * so email delivery problems are visible. In production the caller returns its
 * usual "check your email" state regardless.
 */
export function silentAuthError(action: AuthAction, error: unknown): string | null {
  if (!isDev) {
    logAuthError(action, error);
    return null;
  }
  return authErrorMessage(action, error);
}
