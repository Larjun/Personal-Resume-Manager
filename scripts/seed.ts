/**
 * Seeds the database with a resume parsed from seed/resume.pdf, owned by a dev user.
 * Idempotent: re-running replaces the seed resume (fixed id).
 *
 * The dev user (SEED_USER_EMAIL / SEED_USER_PASSWORD) is created through the
 * Supabase admin API with a confirmed email, or reused if it already exists.
 * Resumes with no owner (created before auth existed) are assigned to it.
 *
 *   npm run seed [-- path/to/resume.pdf]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const SEED_ID = "00000000-0000-4000-8000-000000000001";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See .env.example.`);
  return value;
}

/** Finds the dev user by email, or creates it with a confirmed email. Returns its id. */
async function ensureDevUser(): Promise<string> {
  // Built inline: src/lib/supabase/admin.ts is "server-only" and can't load under tsx.
  const admin = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = requireEnv("SEED_USER_EMAIL").toLowerCase();

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Listing users failed: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      console.log(`Dev user: ${email} (existing)`);
      return found.id;
    }
    if (data.users.length < 200) break;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: requireEnv("SEED_USER_PASSWORD"),
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Creating the dev user failed: ${error?.message}`);
  console.log(`Dev user: ${email} (created)`);
  return data.user.id;
}

async function main() {
  // Imported after loadEnvConfig so DATABASE_URL is set when the client is created.
  const { db, sql } = await import("@/db");
  const { resumes } = await import("@/db/schema");
  const { isNull } = await import("drizzle-orm");
  const { parseResumePdf } = await import("./parse-resume-pdf");

  const userId = await ensureDevUser();

  const file = path.resolve(process.argv[2] ?? "seed/resume.pdf");
  const content = await parseResumePdf(new Uint8Array(readFileSync(file)));
  const now = new Date();
  const title = `Seed – ${content.header.name.split(" ")[0] || "Resume"}`;

  await db
    .insert(resumes)
    .values({ id: SEED_ID, userId, title, pageSize: "Letter", content, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: resumes.id, set: { userId, title, content, updatedAt: now } });

  const claimed = await db
    .update(resumes)
    .set({ userId })
    .where(isNull(resumes.userId))
    .returning({ id: resumes.id });
  if (claimed.length > 0) console.log(`Assigned ${claimed.length} unowned resume(s) to the dev user.`);

  const counts = content.sections.map((s) => s.heading).join(", ");
  console.log(`Seeded "${title}" (${SEED_ID}) from ${path.relative(process.cwd(), file)}`);
  const { email, phone, location, links } = content.header;
  console.log(`  contact: ${[email, phone, location].filter(Boolean).join(" · ")} + ${links.length} links; sections: ${counts}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
