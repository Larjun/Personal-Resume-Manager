import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage } from "./auth-errors";

// NODE_ENV is "test" here, so messages have no [dev: …] suffix.

const api = (status: number, code: string, message = "msg") => new AuthApiError(message, status, code);

describe("authErrorMessage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps known Supabase codes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(authErrorMessage("sign-up", api(400, "email_address_not_authorized"))).toMatch(/can't send email/);
    expect(authErrorMessage("sign-in", api(400, "invalid_credentials"))).toBe("Incorrect email or password.");
    expect(authErrorMessage("sign-up", api(422, "signup_disabled"))).toMatch(/turned off/);
  });

  it("explains weak passwords by reason", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(authErrorMessage("sign-up", new AuthWeakPasswordError("weak", 422, ["pwned"]))).toMatch(/data breach/);
    expect(authErrorMessage("sign-up", new AuthWeakPasswordError("weak", 422, ["length"]))).toMatch(/longer/);
  });

  it("treats 5xx from email-sending actions as a send failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(authErrorMessage("sign-up", api(500, "unexpected_failure", "Error sending confirmation email"))).toMatch(
      /couldn't send the email/,
    );
    expect(authErrorMessage("sign-in", api(500, "unexpected_failure"))).toBe("Couldn't sign you in. Try again.");
  });

  it("handles rate limits and network failures", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(authErrorMessage("sign-in", api(429, "some_new_code"))).toMatch(/Too many/);
    expect(authErrorMessage("sign-in", new AuthRetryableFetchError("fetch failed", 0))).toMatch(/Can't reach/);
  });

  it("logs code, status and message only", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    authErrorMessage("sign-up", api(400, "email_address_invalid", "Email address is invalid"));
    expect(log).toHaveBeenCalledWith("[auth] sign-up failed: email_address_invalid (status 400): Email address is invalid");
  });
});
