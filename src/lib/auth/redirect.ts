/**
 * Turns an untrusted `next` value (query string, form field) into a same-origin
 * path to redirect to after sign-in. Anything else falls back to "/", so it
 * can't become an open redirect.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) return fallback;
  // Must be a path, not a protocol-relative URL ("//evil.com") or "/\evil.com",
  // which browsers treat as "//evil.com".
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Reject control characters (tabs/newlines are stripped by URL parsers).
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

/** Routes that work without a session. Everything else requires sign-in. */
export const PUBLIC_PATH_PREFIXES = ["/login", "/signup", "/forgot-password", "/auth/"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`),
  );
}
