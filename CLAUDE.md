@AGENTS.md

# Personal Resume Manager

A web app for building and maintaining resumes. You edit structured content on the left and see a live, paginated, print-accurate preview on the right. Export is the browser's "Save as PDF", from a print view that reproduces the preview page for page.

## Stage plan

The work happens in stages. Keep the data model structured so that later stages can build on it.

- **Stage 1 (current): non-AI resume editor**
  - **1a: list and data model.** Create, rename, duplicate, delete and open resumes. Drizzle schema on Supabase Postgres. Seed script that parses `seed/resume.pdf`.
  - **1b: editor.** Structured forms for each section type. Sections, entries, bullets and contacts can be reordered with dnd-kit. Section headings can be renamed. Section types: header (name, email, phone, location as plain text, plus links with a URL), summary, entries (experience/projects), publications (title, authors, venue, date, link, optional bullets), education, skills. Entries and papers collapse (closed by default) and have an include checkbox (`visible`): unchecked items stay in the editor but are left out of the resume, and a section whose items are all unchecked disappears. A4/Letter choice per resume. Debounced autosave.
  - **1c: pagination.** Measure blocks off-screen and place them onto fixed-size pages with keep-together rules. Page numbers and page count appear in the preview UI.
  - **1d: export.** A print view with `@page { size; margin: 0 }` and one fixed-size div per page. Text stays selectable.
- **Stage 2: master library.** A reusable library of experiences, projects and bullets. Resumes pick from and reference that library. This is why every entity has a stable `id`.
- **Stage 3: AI features.** Tailoring, rewriting, suggestions and similar. Stage 1 contains **no** AI code.

Work proceeds milestone by milestone. Stop after each one so the user can test and commit.

## Stack

- Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript, Tailwind v4
- Postgres hosted on **Supabase**, accessed through **Drizzle ORM** and the `postgres` (postgres-js) driver. The connection string is `DATABASE_URL` in `.env.local` (see `.env.example`). Supabase Auth is planned but not wired up yet.
- zod v4 for content validation
- dnd-kit for reordering, immer for nested state updates
- Self-hosted fonts from `@fontsource/spectral` (headings and name) and `@fontsource/arimo` (body; it has the same metrics as Arial)
- vitest for unit tests

## Commands

```bash
npm run dev           # dev server
npm run db:generate   # generate a migration after editing src/db/schema.ts
npm run db:migrate    # apply migrations to the DATABASE_URL database
npm run seed          # parse seed/resume.pdf and upsert the seed resume
npm test              # vitest
npm run lint
npx tsc --noEmit      # typecheck
```

## Layout

```
src/app/                    routes: / (list), /resumes/[id] (editor), /resumes/[id]/print
src/server/resumes.ts       read queries (NOT "use server", so they aren't exposed as actions)
src/server/actions.ts       "use server" mutations (all input validated with zod)
src/db/                     drizzle schema + client
src/lib/resume/             content zod schema (source of truth), factories, helpers
src/lib/page/sizes.ts       page geometry (A4/Letter px @96dpi, margins): the ONLY place for it
src/lib/pagination/         content → blocks, paginate() (pure), usePagination hook
src/components/template/    resume block renderers (shared by measure layer, preview, print)
src/components/editor/      editor forms, SortableList
scripts/                    seed + PDF parser (run with tsx)
drizzle/                    generated SQL migrations (committed)
```

## Conventions

- **Content model:** `src/lib/resume/schema.ts` (zod) is the single source of truth. TypeScript types are inferred from it. Never declare a content type by hand.
- **Stable ids:** every section, entry, bullet, contact, school, degree and skill row has a `crypto.randomUUID()` id. Create new items with the factories in `src/lib/resume/factories.ts`. Duplicating a resume gives every item a new id.
- **Storage and versioning:** content lives in the `resumes.content` jsonb column with a `version` field. Any change to its stored shape bumps `CONTENT_VERSION` and adds an upgrade step in `src/lib/resume/migrate.ts`. That step runs inside `ResumeContentSchema` (`z.preprocess`), so old rows are upgraded on read and written back in the new shape on the next save. No SQL data migration is needed. Validate with zod at every boundary: server actions, the seed script, and rows read from the DB.
- **Template components** in `src/components/template/` are pure, deterministic, client-safe components. The measure layer, the preview and the print view must all render the same components, so that measured heights match what gets rendered.
- **Spacing between blocks** uses padding, never margins, so block heights add up exactly when paginating. Typography uses fixed `pt`/`px` sizes and line-heights. Don't use viewport units or responsive classes inside the template.
- **CSS:** Tailwind is used for app chrome only, and the Turbopack Tailwind loader is scoped to `globals.css` in `next.config.ts` (scoping it to every `*.css` breaks CSS Modules). Template styles live in `src/components/template/template.module.css`.
- **Dates** are structured (`{ year, month | null }`, and an end can be `"present"`), never free text. Every date on the resume is formatted with the resume-wide `content.settings.dateFormat` through `src/lib/resume/dates.ts`: `toBlocks` puts pre-formatted `dateText` into each block. Validation (end before start, missing month) lives in `dates.ts` too, and the editor shows the problems as warnings instead of blocking saves.
- **Page geometry** (page size, margins, content box) comes from `src/lib/page/sizes.ts`. Don't hard-code it anywhere else.
- **Data reads:** server components that read the DB must sit inside `<Suspense>` (a `cacheComponents` requirement). Mutations go through server actions in `src/server/`.
- **Database access** goes through Drizzle on the server only. The `resumes` table has RLS turned on with no policies, so Supabase's public Data API (the anon and authenticated keys) can't touch it. Our server connects as the `postgres` role, which bypasses RLS, so **access control lives in server code**. Once auth lands, every query must filter by `user_id`.
- **Schema changes** go through `src/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`. Never edit tables in the Supabase dashboard. Drizzle only manages the `public` schema; Supabase owns `auth`, `storage` and the rest.
- **Ids:** resume ids are UUIDs. Validate them with `ResumeIdSchema` before querying, because Postgres throws on a malformed UUID.
- **Pure logic** (`paginate`, parsers, schema helpers) gets vitest tests next to the code as `*.test.ts`.
