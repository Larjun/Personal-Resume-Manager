@AGENTS.md

# Personal Resume Manager

A web app for building and maintaining resumes. You edit structured content on the left and see a live, paginated, print-accurate preview on the right. Export is the browser's "Save as PDF", from a print view that reproduces the preview page for page.

## Stage plan

The work happens in stages. Keep the data model structured so that later stages can build on it.

- **Stage 1 (done): non-AI resume editor**
  - **1a: list and data model.** Create, rename, duplicate, delete and open resumes. Drizzle schema on Supabase Postgres. Seed script that parses `seed/resume.pdf`.
  - **1b: editor.** Structured forms for each section type. Sections, entries, bullets and contacts can be reordered with dnd-kit. Section headings can be renamed. Section types: header (name, email, phone, location as plain text, plus links with a URL), summary, entries (experience/projects), publications (title, authors, venue, date, link, optional bullets), education, skills. Entries and papers collapse (closed by default) and have an include checkbox (`visible`): unchecked items stay in the editor but are left out of the resume, and a section whose items are all unchecked disappears. A4/Letter choice per resume. Debounced autosave.
  - **1c: pagination.** Measure blocks off-screen and place them onto fixed-size pages with keep-together rules. Page numbers and page count appear in the preview UI.
  - **1d: export.** A print view with `@page { size; margin: 0 }` and one fixed-size div per page. Text stays selectable.
- **Later stages** are specified in `docs/stage-prompts.md`, one prompt per stage:
  - 1.5 (done) auth (Supabase: email + Google) and account settings
  - 2 master library: items, bullet pool, variants, tags. This is why every entity has a stable `id`.
  - 3 AI resume parsing and usage logging
  - 3.5 usage dashboard and limits
  - 4 AI bullet writing
  - 5 job postings and tailored resumes
  - 6 grade and revise
  - 7 resume collection, versions and PDF downloads

  No AI code exists before Stage 3.

Work proceeds milestone by milestone. Stop after each one so the user can test and commit.

## Stack

- Next.js 16 (App Router, `cacheComponents` on), React 19, TypeScript, Tailwind v4
- Postgres hosted on **Supabase**, accessed through **Drizzle ORM** and the `postgres` (postgres-js) driver. The connection string is `DATABASE_URL` in `.env.local` (see `.env.example`). Auth: see Stage 1.5 in `docs/stage-prompts.md` (Supabase Auth).
- zod v4 for content validation
- dnd-kit for reordering, immer for nested state updates
- Self-hosted fonts from `@fontsource/spectral` (headings and name) and `@fontsource/arimo` (body; it has the same metrics as Arial)
- vitest for unit tests

## Commands

```bash
npm run dev           # dev server
npm run db:generate   # generate a migration after editing src/db/schema.ts
npm run db:migrate    # apply migrations to the DATABASE_URL database
npm run seed          # create/find the dev user (SEED_USER_*), upsert the seed resume it owns
npm test              # vitest
npm run lint
npx tsc --noEmit      # typecheck
```

## Layout

```
src/app/                    routes: / (list), /resumes/[id] (editor), /resumes/[id]/print, /account
src/app/(auth)/             /login, /signup, /forgot-password, /reset-password (shared narrow layout)
src/app/auth/confirm        GET handler for every email link (verifyOtp with token_hash)
src/app/auth/callback       GET handler for Google OAuth (exchangeCodeForSession)
src/proxy.ts                session refresh + optimistic redirect to /login (Next 16's middleware)
src/server/auth.ts          getSessionUser() / requireUser() (+ getAuthUser / requireAuthUser for the full User)
src/server/account.ts       getAccount(), ensureProfile() for /account (reads, not "use server")
src/server/account-actions.ts "use server" name, password, email, Google link/unlink, delete account
src/server/auth-errors.ts   Supabase auth error → log line + user message
src/server/resumes.ts       read queries (NOT "use server", so they aren't exposed as actions)
src/server/actions.ts       "use server" mutations (all input validated with zod)
src/server/auth-actions.ts  "use server" sign in/up/out, Google, resend, forgot/reset password
src/lib/supabase/           server (cookies), admin (service role, server-only) clients
src/components/auth/        auth forms, FormParts (Field, SubmitButton, messages), shared classes
src/components/account/     account page sections
src/lib/auth/redirect.ts    safeNextPath() for post-login redirects, public route list
src/db/                     drizzle schema + client
src/lib/resume/             content zod schema (source of truth), factories, helpers
src/lib/page/sizes.ts       page geometry (A4/Letter px @96dpi, margins): the ONLY place for it
src/lib/pagination/         content → blocks, paginate() (pure), usePagination hook
src/components/template/    resume block renderers (shared by measure layer, preview, print)
src/components/editor/      editor forms, SortableList
scripts/                    seed + PDF parser (run with tsx)
drizzle/                    generated SQL migrations (committed)
```

## Supabase dashboard setup (Authentication section)

The app depends on these settings; they aren't in code. Redo them for each environment (Site URL changes in production).

- **URL Configuration:** Site URL `http://localhost:3000`. Redirect URLs: `http://localhost:3000/**` (needed for Google's `redirectTo`).
- **Providers → Email:** Confirm email **on**. Secure email change **on**. Minimum password length 8.
- **Providers → Google:** enabled with an OAuth client from Google Cloud Console whose authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Sign In / Providers → Allow manual linking:** on. "Connect Google" on /account needs it (`manual_linking_disabled` otherwise).
- **Emails → SMTP:** Resend (`smtp.resend.com`, port 465, user `resend`, password = Resend API key, sender on a domain verified in Resend). Supabase's built-in sender only reaches project team members and is heavily rate-limited.
- **Emails → Templates:** links must go to `/auth/confirm` with a token hash, not `{{ .ConfirmationURL }}`, so they work in any browser or device:
  - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`
  - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
  - Change email address: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/account`
- **Emails → Templates → Reauthentication:** keep `{{ .Token }}` in it (the 6-digit code for "Set a password").
- **Rate Limits:** Supabase's built-in per-IP limits cover sign-in, sign-up, password recovery and email sends. That's our only rate limiting. Keep the defaults unless they get in the way of testing.

## Conventions

- **Content model:** `src/lib/resume/schema.ts` (zod) is the single source of truth. TypeScript types are inferred from it. Never declare a content type by hand.
- **Stable ids:** every section, entry, bullet, contact, school, degree and skill row has a `crypto.randomUUID()` id. Create new items with the factories in `src/lib/resume/factories.ts`. Duplicating a resume gives every item a new id.
- **Storage and versioning:** content lives in the `resumes.content` jsonb column with a `version` field. Any change to its stored shape bumps `CONTENT_VERSION` and adds an upgrade step in `src/lib/resume/migrate.ts`. That step runs inside `ResumeContentSchema` (`z.preprocess`), so old rows are upgraded on read and written back in the new shape on the next save. No SQL data migration is needed. Validate with zod at every boundary: server actions, the seed script, and rows read from the DB.
- **Template components** in `src/components/template/` are pure, deterministic, client-safe components. The measure layer, the preview and the print view must all render the same components, so that measured heights match what gets rendered.
- **Spacing between blocks** uses padding, never margins, so block heights add up exactly when paginating. Typography uses fixed `pt`/`px` sizes and line-heights. Don't use viewport units or responsive classes inside the template.
- **CSS:** Tailwind is used for app chrome only, and the Turbopack Tailwind loader is scoped to `globals.css` in `next.config.ts` (scoping it to every `*.css` breaks CSS Modules). Template styles live in `src/components/template/template.module.css`.
- **Dates** are structured (`{ year, month | null }`, and an end can be `"present"`), never free text. Every date on the resume is formatted with the resume-wide `content.settings.dateFormat` through `src/lib/resume/dates.ts`: `toBlocks` puts pre-formatted `dateText` into each block. Validation (end before start, missing month) lives in `dates.ts` too, and the editor shows the problems as warnings instead of blocking saves.
- **Pagination:** `usePagination(content, pageSize)` portals an invisible copy of every block to `<body>`, at the page's content width and outside any scaled container, and measures each one with `getBoundingClientRect`. It then calls the pure `paginate()` with a 2px safety margin. It re-measures 150ms after content changes, immediately when the page size changes, and when `document.fonts` finishes loading. The preview and the print view both render pages with `PageView`. Never add margins, or styles that depend on a block's position, to template blocks, or measured heights will stop matching the rendered pages.
- **Export:** `/resumes/[id]/print` renders the same `usePagination` and `PageView` pages, with `@page { size; margin: 0 }` and `break-after: page`. `?autoprint=1` opens the print dialog once pages are laid out. The editor's Print button waits for `flush()` (pending autosaves) before opening it. Template symbols (bullets, arrows) are drawn with CSS/SVG, never font glyphs, so the PDF embeds only the self-hosted fonts.
- **Page geometry** (page size, margins, content box) comes from `src/lib/page/sizes.ts`. Don't hard-code it anywhere else.
- **Data reads:** server components that read the DB must sit inside `<Suspense>` (a `cacheComponents` requirement). Mutations go through server actions in `src/server/`.
- **Database access** goes through Drizzle on the server only. User-data tables have RLS turned on with no policies, so Supabase's public Data API (the anon and authenticated keys) can't touch them. Our server connects as the `postgres` role, which bypasses RLS, so **access control lives in server code**.
- **Every query filters by `user_id`.** Every read function in `src/server/*.ts`, every server action and every route handler starts with `const user = await requireUser()` and scopes its query to `user.id` (`and(eq(table.id, id), eq(table.userId, user.id))`). Another user's id must behave exactly like a missing one (return `null` → `notFound()`). Pages never query tables directly. `src/proxy.ts` only does an optimistic redirect; never rely on it for access control. It redirects **GET/HEAD navigations only**: a redirect in reply to a server action POST isn't an action response, and the client throws "An unexpected response was received from the server". Actions get their redirect from `requireUser()` instead.
- **User-data tables** follow the `resumes` pattern: `user_id` (or `id` for `profiles`) references `authUsers` from `drizzle-orm/supabase` with `onDelete: "cascade"`, gets an index, and `.enableRLS()`. Deleting an account in Supabase Auth deletes all of its rows.
- **Auth in render:** `getSessionUser()` calls `await connection()` before supabase-js runs (it reads `Date.now()`, which `cacheComponents` forbids while prerendering), and it uses `getUser()` so deleted accounts are rejected immediately. Components that call it must sit inside `<Suspense>`. Under streaming, `notFound()` renders the not-found UI with HTTP 200; that's expected.
- **Auth messages never reveal whether an email has an account.** Forgot password and resend always return the same "check your email" state, even on errors. Sign-up relies on Supabase returning a fake success for existing emails. Sign-in uses one message for unknown email and wrong password.
- **Auth errors** go through `src/server/auth-errors.ts`: `authErrorMessage(action, error)` logs `[auth] <action> failed: <code> (status N): <message>` on the server and returns a specific user message (in development with a `[dev: …]` suffix showing the raw Supabase code). Resend and forgot password use `silentAuthError()`, which surfaces the error only in development. Never log form data. Unexpected throws land in `src/app/error.tsx`.
- **Tests** can import `server-only` modules (`vitest.config.mts` aliases it to an empty module).
- **Redirect targets** from `?next=` or form fields always go through `safeNextPath()` (`src/lib/auth/redirect.ts`).
- **Account vs resume data:** account data is the sign-in email (Supabase Auth) and `profiles.display_name`. The name, email, phone and links printed on a resume live in that resume's `content.header`. Never sync one into the other.
- **Profiles** are created lazily by `ensureProfile()` (insert … on conflict do nothing), with the display name prefilled from Google's `full_name`. There's no DB trigger on `auth.users`.
- **Reading `auth.users`:** `getAccount()` reads `encrypted_password` (only whether it's empty) because Supabase's API doesn't say whether a user has a password. Reading the `auth` schema is fine; never write to it. Use the Supabase Auth API for changes.
- **Account actions:**
  - Change password re-verifies the current one with `signInWithPassword`.
  - Google-only accounts set a password with `reauthenticate()` (emailed 6-digit code, the Reauthentication template) plus `updateUser({ password, nonce })`.
  - Both sign out other sessions (`signOut({ scope: "others" })`).
  - Email change relies on "Secure email change" (both addresses confirm).
  - Google can be disconnected only when the account has a password and another identity.
  - Delete uses the admin API; FK cascades remove the user's rows.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) is used only via `src/lib/supabase/admin.ts` (`server-only`) and the seed script. Never `NEXT_PUBLIC_`.
- **Schema changes** go through `src/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`. Never edit tables in the Supabase dashboard. Drizzle only manages the `public` schema; Supabase owns `auth`, `storage` and the rest.
- **Ids:** resume ids are UUIDs. Validate them with `ResumeIdSchema` before querying, because Postgres throws on a malformed UUID.
- **Pure logic** (`paginate`, parsers, schema helpers) gets vitest tests next to the code as `*.test.ts`.
