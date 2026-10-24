/**
 * Imports a resume into its owner's master library (Stage 2d's "Import into
 * library", runnable from the command line). Defaults to the seed resume.
 * Safe to re-run: linked or matching items are never duplicated.
 *
 *   npm run library:import [-- <resume-id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const SEED_ID = "00000000-0000-4000-8000-000000000001";

async function main() {
  // Imported after loadEnvConfig so DATABASE_URL is set when the client is created.
  const { db, sql } = await import("@/db");
  const { resumes } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { importResumeIntoLibrary } = await import("@/db/library-import");

  const resumeId = process.argv[2] ?? SEED_ID;
  const [resume] = await db
    .select({ userId: resumes.userId, title: resumes.title })
    .from(resumes)
    .where(eq(resumes.id, resumeId));
  if (!resume) throw new Error(`Resume ${resumeId} not found${resumeId === SEED_ID ? "; run npm run seed first" : ""}.`);

  const counts = await importResumeIntoLibrary(db, resume.userId, resumeId);
  console.log(`Imported "${resume.title}" into the library:`, counts);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
