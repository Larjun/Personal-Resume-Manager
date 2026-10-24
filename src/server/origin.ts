import "server-only";
import { headers } from "next/headers";

/**
 * This request's origin (e.g. http://localhost:3000), for building auth redirect
 * URLs. Supabase only accepts redirect URLs on the project's allow list, so a
 * spoofed Host header can't send users elsewhere.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
