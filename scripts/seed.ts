/**
 * Seeds the database with a resume parsed from seed/resume.pdf.
 * Idempotent: re-running replaces the seed resume (fixed id).
 *
 *   npm run seed [-- path/to/resume.pdf]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const SEED_ID = "00000000-0000-4000-8000-000000000001";

async function main() {
  // Imported after loadEnvConfig so DATABASE_URL is set when the client is created.
  const { db, sql } = await import("@/db");
  const { resumes } = await import("@/db/schema");
  const { parseResumePdf } = await import("./parse-resume-pdf");

  const file = path.resolve(process.argv[2] ?? "seed/resume.pdf");
  const content = await parseResumePdf(new Uint8Array(readFileSync(file)));
  const now = new Date();
  const title = `Seed – ${content.header.name.split(" ")[0] || "Resume"}`;

  await db
    .insert(resumes)
    .values({ id: SEED_ID, title, pageSize: "Letter", content, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: resumes.id, set: { title, content, updatedAt: now } });

  const counts = content.sections.map((s) => s.heading).join(", ");
  console.log(`Seeded "${title}" (${SEED_ID}) from ${path.relative(process.cwd(), file)}`);
  console.log(`  ${content.header.contacts.length} contacts; sections: ${counts}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
