# Resume Builder — Stage Prompts (1.5 → 7)

Paste-ready prompts for Claude Code, one per stage. Save this file in your repo as `docs/stage-prompts.md` so it stays with the project.

## How to use these

- **One stage per Claude Code session.** Run `/clear` before starting a new stage so old context doesn't carry over. CLAUDE.md holds what each stage needs to know about the project.
- **Start in plan mode** (Shift+Tab). Read the plan before approving it, especially the data model changes.
- **Commit after each milestone.** Every prompt tells Claude Code to stop after each one so you can test.
- **Each stage ends by updating CLAUDE.md**, so the next stage starts with an accurate picture.
- Each stage has a **"You check"** list. Go through it yourself before moving on.

**Repo facts these prompts assume** (CLAUDE.md has the details):
- Postgres on **Supabase**, accessed through Drizzle (postgres-js). Supabase Auth owns users (`auth.users`); Drizzle manages only the `public` schema.
- Data access: reads in `src/server/<area>.ts` (not "use server"), mutations in `src/server/actions*.ts` ("use server", zod-validated). Pages never query tables directly.
- Every user-data table follows the `resumes` pattern: `user_id` FK to `auth.users` with cascade delete, an index on it, and `.enableRLS()` with no policies. The server connects as `postgres` (bypasses RLS), so every query filters by the current user's id.
- Resume content is one jsonb document (`resumes.content`) validated by `src/lib/resume/schema.ts`. Changing its shape means bumping `CONTENT_VERSION` and adding a step in `src/lib/resume/migrate.ts`.
- Files (uploaded postings, saved PDFs) go in **private Supabase Storage buckets**, accessed server-side only.

| Stage | What | AI? |
|---|---|---|
| 1.5 | Auth (Supabase: email + Google), account settings | No |
| 2 | Master library (items, bullet pool, variants, tags) | No |
| 3 | Resume upload → AI parsing, usage logging | Yes |
| 3.5 | Usage dashboard, per-user limits, admin view | No (reads logs) |
| 4 | AI bullet writing and rewriting | Yes |
| 5 | Job postings → recommendations → tailored resume | Yes |
| 6 | Grade and revise loop | Yes |
| 7 | Resume collection by job, versions, one-click downloads | No |

---

## Stage 1.5 — Auth, account settings, Postgres

```text
Read CLAUDE.md first. Stage 1 (local resume editor) is done. This is Stage 1.5: add
real user accounts so every later stage is built per user from the start.

Decisions already made:
- Stay on Supabase Postgres with Drizzle (already set up). Schema and migrations
  stay in drizzle-kit, limited to the public schema.
- Auth: Supabase Auth through @supabase/ssr. Two sign-in methods: email + password,
  and Google OAuth (Supabase's Google provider; the client ID/secret live in the
  Supabase dashboard, not in .env.local). A Google account and an email account
  with the same verified address are the same user (Supabase links them).
  Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and
  SUPABASE_SERVICE_ROLE_KEY (server only; used only by the seed script and
  account deletion, imported only from "server-only" modules).
- Email: Resend set up as custom SMTP in the Supabase dashboard. Supabase sends
  the verification, reset, and email-change emails (our server never sees the links).
- Rate limits: Supabase Auth's built-in limits (dashboard → Auth → Rate Limits).

Milestones (stop after each so I can test and commit):

1.5a — Auth foundation and per-user data
  - resumes.user_id becomes NOT NULL with a foreign key to auth.users (authUsers
    from drizzle-orm/supabase), on delete cascade, plus an index. Existing rows
    have a null user_id, so: migration with the FK + index → seed claims orphan
    rows → migration that sets NOT NULL.
  - New profiles table (id = auth.users.id, cascade; display_name; timestamps;
    RLS on, no policies). Rows are created lazily with an upsert.
  - src/proxy.ts (Next 16's name for middleware) refreshes the session cookie and
    redirects signed-out users to /login. That is an optimistic check only. The
    real gate is requireUser() in src/server/auth.ts, called by every read
    function, server action, and route handler. It refuses unverified emails.
  - Every query for user data filters by the current user's id, in
    src/server/resumes.ts and src/server/actions.ts. Pages never query tables
    directly. Another user's resume id returns null, so the page 404s.
  - Seed script creates or finds a confirmed dev user (SEED_USER_EMAIL /
    SEED_USER_PASSWORD) via the admin API and assigns the seed resume to them.

1.5b — Auth flows
  - Sign up (email verification required before first use), log in, log out,
    forgot password, reset password via emailed link.
  - Email links point to /auth/confirm?token_hash=...&type=..., which calls
    verifyOtp. Tokens expire and are single-use (Supabase's built-in behavior).
    List the email template changes I need to make in the dashboard.
  - "Forgot password" must respond the same whether or not the email exists.
  - "Continue with Google" on the login and sign-up pages: signInWithOAuth with
    redirectTo /auth/callback, which calls exchangeCodeForSession and redirects to
    a validated same-origin "next" path (never an open redirect). Google accounts
    count as verified. OAuth errors or a cancelled consent screen go back to
    /login with a readable message.
  - Clean, simple pages that match the app's existing style.

1.5c — Account settings page
  - Change display name (profiles; prefill from Google's name on first sign-in),
    change password (check the current password first), change email (secure
    email change: confirm the new address), delete account (confirm by typing the
    email; admin deleteUser, and cascades remove all of the user's data).
  - Show which sign-in methods the account has (email/password, Google). A
    Google-only account sees "Set a password" instead of "Change password": it
    uses Supabase's reauthenticate() (emailed code) + updateUser({ password, nonce }).
  - "Connect Google" (linkIdentity) for email accounts and "Disconnect" (unlinkIdentity),
    which is refused when it would leave the account with no way to sign in.
  - Keep account details separate from resume contact info. The name, phone, and
    links printed on a resume are resume data, not account data.

Rules:
- Never log passwords or tokens. All secrets come from .env.local; add the new
  vars to .env.example with placeholder values.
- At the end, update CLAUDE.md: auth stack, the requireUser() + "every query
  filters by user_id" rule, profiles, migration/seed order, env vars, and a
  checklist of the Supabase dashboard settings.
```

**You check:**
- Two accounts in two browsers (one normal window, one private) can't see each other's resumes, including by pasting a resume URL from the other account.
- An account that hasn't verified its email can't use the app.
- Sign up with email, then "Continue with Google" with the same Gmail address: you land in the same account with the same resumes.
- A Google-only account can set a password and then log in with it.
- Reset link works once, then fails. An expired link fails.
- "Forgot password" with an unknown email shows the same message as with a real one.
- Deleting an account removes its resumes and profile from the database (check in Drizzle Studio or the Supabase table editor).

---

## Stage 2 — Master library

```text
Read CLAUDE.md first. This is Stage 2: a master library of everything the user has
done (experiences, projects, education, skill groups, summaries). Resumes are built by
picking items from the library. No AI in this stage, but the data model must be ready
for AI features later (AI will fill the library, add tags, and add bullet variants).

Data model (every table follows the resumes pattern: user_id FK to auth.users with
cascade, index, RLS on with no policies; every query goes through src/server/ and
filters by user id):
- LibraryItem: id, userId, kind (experience | project | publication | education |
  skills | summary), fields (zod-validated; shape depends on kind and reuses the
  content schemas in src/lib/resume/schema.ts: experience and project both map to
  the "entries" section type's EntrySchema, publication to PaperSchema, etc.),
  tags[], createdAt, updatedAt.
- LibraryBullet: id, itemId, order, tags[]. A bullet has one or more variants.
- BulletVariant: id, bulletId, text, label (optional, e.g. "short", "detailed"),
  source ("user" | "ai"), createdAt.
- A library item holds MORE bullets than any single resume uses. Resumes pick a subset.

Resumes stay self-contained copies (a resume that has been sent must never change by
itself). Resume entries and bullets live inside the resumes.content jsonb, not in
tables, so source tracking goes on the content zod schemas (EntrySchema, PaperSchema,
SchoolSchema, SkillRowSchema, BulletSchema, summary section as needed). Bump
CONTENT_VERSION and add a step in src/lib/resume/migrate.ts that fills the new fields
with null:
- entry: sourceItemId (nullable), sourceItemUpdatedAt (nullable; when it was copied)
- bullet: sourceBulletId (nullable), sourceVariantId (nullable), text (the copy)
- cloneWithNewIds (Duplicate) keeps the source fields; only our own ids change.

Milestones (stop after each):

2a — Library page
  - Tabs by kind, text search, filter by tags.
  - Create/edit/delete items. Edit the bullet pool: add, reorder (dnd-kit), delete
    bullets; add and label variants per bullet.
  - Show "Used in N resumes" on each item.

2b — "Add from library" drawer in the resume editor
  - Filter by kind or tag, check items to add.
  - Expand an item to choose which bullets, and which variant of each.
  - Adding copies the content into the right section of the resume, with source ids set.

2c — Sync between library and resumes
  - If the library item changed after it was copied (updatedAt > sourceItemUpdatedAt),
    show a "Library updated" badge on the resume entry, with "Pull latest" that shows
    a text diff (use the `diff` package) before applying.
  - If the user edits a copied bullet in a resume, offer "Save to library as new
    variant" or "Keep in this resume only".
  - If the source item is deleted, the resume keeps its copy and shows "source deleted".

2d — Import + tags
  - "Import into library" on an existing resume: create library items from its
    entries, then link the resume's entries to them (set source ids). Run it on the
    seed resume.
  - Tag input with autocomplete from the user's existing tags.
  - A tag alias map in code (src/lib/tags.ts, with vitest tests), e.g. ts → TypeScript, js → JavaScript,
    postgres → PostgreSQL, k8s → Kubernetes. Normalize every tag before saving.

At the end, update CLAUDE.md with the library model and the copy-with-sync rule.
```

**You check:**
- Edit a library bullet. The resume shows "Library updated", and the diff is correct.
- A resume entry with "Keep in this resume only" edits doesn't change the library.
- Importing the seed resume twice doesn't create duplicates, or at least warns you.

---

## Stage 3 — Resume upload, AI parsing, usage logging

```text
Read CLAUDE.md first. This is Stage 3, the first AI feature: the user uploads an
existing resume, Claude parses it into structured data, the user reviews it, and it is
saved into the library. Every AI call is logged for per-user usage tracking from day one.

Use the claude-api skill for current Anthropic SDK usage (@anthropic-ai/sdk,
TypeScript). ANTHROPIC_API_KEY is in .env.local. Rules for all AI code:
- Use structured outputs: client.messages.parse with zodOutputFormat from
  @anthropic-ai/sdk/helpers/zod. Do not parse JSON out of free text.
- Do not send temperature/top_p/top_k or assistant prefills (current models reject them).
- Always check stop_reason before using output: handle "refusal" and "max_tokens"
  with a clear user-facing error. Enable server-side refusal fallbacks as the
  claude-api skill describes.
- Models live in one config file (src/lib/ai/models.ts) so they're easy to change:
  parsing = "claude-sonnet-5-5", tagging = "claude-haiku-5-5".

Milestones (stop after each):

3a — AI foundation and usage logging
  - src/lib/ai/client.ts (import "server-only") is the ONLY file that imports the Anthropic SDK. It exports a
    helper like callClaude({ userId, feature, params }) that:
      1. calls assertUnderLimit(userId) before the request (stub that always passes
         for now; real limits come in Stage 3.5),
      2. makes the request,
      3. inserts an ai_usage row whether the call succeeds, is refused, or errors.
  - ai_usage table: id, userId, feature, model, inputTokens, outputTokens,
    cacheReadTokens, cacheWriteTokens, costUsd (computed and stored at call time),
    requestId, stopReason, error (nullable), createdAt. Index on (userId, createdAt).
    Same table pattern as resumes (FK to auth.users with cascade, RLS on).
  - src/lib/ai/pricing.ts: per-model $ per million tokens. Input/output:
    claude-opus-5-5 $4/$20, claude-sonnet-5-5 $2/$10, claude-haiku-5-5 $0.10/$0.50
    (Haiku: prompts up to 100K tokens). Leave a clear TODO to verify these and the
    cache rates against Anthropic's pricing page.
  - AI server actions and routes call requireUser(). Never expose the API key to the browser.

3b — Upload and parse
  - Upload page accepts PDF and DOCX (max 5 MB). PDFs go to Claude directly as a
    base64 document block. DOCX is converted to text server-side with `mammoth`.
  - Parse schema (zod): contact { name, email, phone, links[] }, experiences[]
    { company, title, location, startDate, endDate, bullets[] }, projects[] { name,
    techStack[], link, bullets[] }, education[] { school, degree, field, location,
    graduationDate, gpa, details[] }, skills[] { category, items[] },
    other[] { heading, items[] }. Use .nullable() for anything that might be missing.
  - System prompt: copy text exactly as written, never rewrite or improve; use null
    for missing fields, never guess; keep dates as written; unknown sections go to "other".
  - Our code assigns all ids after parsing. The model never creates ids.
  - Review screen: every parsed item is editable before saving. The user can
    discard items and mark items that duplicate an existing library item (simple
    matching by company+title or project name). On confirm, save to the library.
    Parsed contact info is saved as the user's default resume header
    (profiles.default_header jsonb, validated with HeaderSchema) and used when
    creating new resumes. It never changes the account email or display name.
  - Keep scripts/parse-resume-pdf.ts (the seed's deterministic parser) as is; it
    is not replaced by the AI parser.

3c — AI tag suggestions
  - After saving items (and when an item is created or edited in the library), call
    Haiku to suggest tags: skills, domains, role types, plus a hasMetrics boolean
    and a one-line summary. Pass the user's existing tags and ask it to reuse them.
  - Normalize suggested tags with src/lib/tags.ts. Store which tags came from AI vs the
    user. Never re-add a tag the user removed.

At the end, update CLAUDE.md: the "all AI calls go through callClaude" rule, the
models config, and the AI rules above.
```

**You check:**
- Upload your real resume. The review screen shows every job, project, and degree, and the bullets match word for word.
- Every upload adds a row to `ai_usage` with a cost that looks right.
- A deliberately broken file (an image renamed to .pdf) gives a clean error, not a crash.

---

## Stage 3.5 — Usage dashboard and limits

```text
Read CLAUDE.md first. This is Stage 3.5: show users their AI usage and enforce
per-user limits, using the ai_usage table from Stage 3. No new AI calls.

Milestones (stop after each):

3.5a — Usage dashboard (per user)
  - Page under account settings: spend and tokens this month, a daily chart for the
    last 30 days, breakdown by feature and by model, and a table of recent calls
    (time, feature, model, tokens, cost, status).
  - All numbers come from SQL aggregates on ai_usage, filtered by userId.

3.5b — Limits
  - Monthly budget per user (default in config, e.g. $2.00; overridable per user
    in profiles.monthly_budget_usd, nullable = use the default).
  - Make assertUnderLimit real: sum this calendar month's (UTC) costUsd and block the
    call if it would exceed the budget, with a typed error that the UI shows as a
    friendly message ("You've used this month's AI credits; they reset on <date>",
    with the date computed as the first of next month).
  - Show a usage meter in the app header or sidebar once usage passes 80%.

3.5c — Admin view
  - An ADMIN_EMAILS env var lists admin accounts (match against the verified email
    from requireUser()). Admin-only page: total spend
    today/this month, top users by spend, spend by feature, and recent failed or
    refused calls. Non-admins get a 404, not a 403.

At the end, update CLAUDE.md.
```

**You check:**
- Set your budget to $0.01 and try an upload. It should be blocked with the friendly message, and **no** API request should be made.
- Dashboard totals match what you see in the Anthropic Console's usage page (roughly; check after a few calls).

---

## Stage 4 — AI bullet writing

```text
Read CLAUDE.md first. This is Stage 4: AI helps write and rewrite bullets. All calls
go through callClaude. AI output is saved as bullet VARIANTS (source "ai") in the
library; it never overwrites the user's text.

Model: "claude-opus-5-5" for writing (add to src/lib/ai/models.ts).

Shared writing rules (put in one system prompt in src/lib/ai/prompts/bullets.ts):
- Start with a strong action verb; show impact; about 25 words max.
- NEVER invent numbers, tools, technologies, or accomplishments that aren't in the
  input. If a metric would help but isn't given, use a placeholder like [X%] or [N users].
- Include 2-3 example bullets in the system prompt that show the style we want
  (use bullets from my seed resume as the examples).

Milestones (stop after each):

4a — Rewrite a bullet
  - "Rewrite" button on any library bullet. Returns 3 distinct options (structured
    output: { options: string[] }). Optional instruction field ("shorter", "focus on
    leadership", "mention Python").
  - The user picks one or more options to save as new variants. Placeholders like
    [X%] are highlighted so the user fills them in.

4b — Generate bullets from notes
  - On a library item, the user writes rough notes ("built a Flask API for file
    uploads, used by ~200 students"). Returns 3-5 bullets based only on the notes
    and the item's existing fields. User picks which to add to the bullet pool.

4c — Polish
  - Show cost per action in the UI after it runs (from the usage row).
  - Stream the options into the UI as they're written if it's straightforward with
    structured output; otherwise show a loading state. Don't block on this.

At the end, update CLAUDE.md.
```

**You check:**
- Rewrite a bullet with no numbers in it. The options should use placeholders, never made-up metrics.
- The original bullet text is unchanged after saving variants.

---

## Stage 5 — Job postings, recommendations, tailored resumes

```text
Read CLAUDE.md first. This is Stage 5: the user adds a job posting, the app
recommends which library items to include, the user checks boxes, and AI writes a
resume tailored to the job using ONLY the checked items. All calls go through callClaude.

Models: extraction = "claude-haiku-5-5"; recommend and write = "claude-opus-5-5".

Data model:
- JobPosting: id, userId, companyName, roleTitle, location, sourceUrl (nullable,
  the user types it; we don't fetch it), originalText, originalFileKey (nullable;
  object key in a private Supabase Storage bucket, read server-side only),
  requirements (jsonb, zod-validated), createdAt. Same table pattern as resumes.
- Requirement: { id (we assign), text, kind: "required" | "nice_to_have",
  keywords[] }.
- Resumes get a nullable job_id (FK to job_postings, on delete set null, indexed).
  A tailored resume is a normal resume (same editor, same content schema) linked to
  a job. Deleting a job keeps its resumes.

Milestones (stop after each):

5a — Add a job posting
  - Paste text or upload a PDF. Extract companyName, roleTitle, location, and
    requirements with keywords. Show it for review/edit before saving.

5b — Recommendation screen
  - Code first: score each library item by overlap between its tags and the
    requirement keywords (normalized via src/lib/tags.ts). Show "matches N of M".
  - Then one AI call with every library item's summary/tags and the requirements.
    Build the output schema from our data so ids can't be made up:
      itemId: z.enum(<actual item ids>), relevance: "high" | "medium" | "low",
      matchedRequirements: z.array(z.enum(<actual requirement ids>)),
      reason: one sentence. Plus gaps: z.array(z.enum(<requirement ids>)) for
      requirements nothing covers.
  - UI: list of items with checkboxes ("high" pre-checked), matched requirements as
    chips, the reason, and a gaps banner at the top. Show an estimated page count as
    boxes are checked (computed from bullet counts; the exact count comes from
    paginate() once the resume exists).

5c — Write the tailored resume
  - Filter the library down to the checked items IN CODE and send only those. The
    model never sees unchecked items.
  - Output schema: summary (nullable), sections[] { itemId: z.enum(<checked ids>),
    bullets[] { sourceBulletIds: string[], text } }, skillsLine[].
  - Same no-invented-facts rule and placeholders as Stage 4.
  - Our code assembles a new resume from the output with the factories in
    src/lib/resume/factories.ts (new ids, source fields set from Stage 2, header
    from profiles.default_header, page size from the user's default), validates it
    with ResumeContentSchema, sets jobId, titles it "<roleTitle> — <companyName>",
    and opens it in the editor. The library is never modified.

At the end, update CLAUDE.md.
```

**You check:**
- Unchecked items never show up in the generated resume.
- Every tailored bullet can be traced to its source bullets (show this in the editor, e.g. on hover).
- Try a posting that asks for something you don't have. It should appear under gaps, not as an invented bullet.

---

## Stage 6 — Grade and revise

```text
Read CLAUDE.md first. This is Stage 6: grade a tailored resume against its job posting
and revise it based on the grade. All calls go through callClaude. Model:
"claude-opus-5-5" for grading and revising.

Milestones (stop after each):

6a — Grade
  - Keyword coverage IN CODE: which requirement keywords appear in the resume text
    (normalized), as a percentage and a list of missing keywords. This is the
    "ATS match" score and must give the same result every time.
  - AI rubric grade in a FRESH call that sees only the resume and the requirements
    (never the writing prompt or history). Structured output: scores per criterion
    as letter grades (relevance to role, impact/metrics, clarity, readability),
    an overall grade, and issues[] { bulletId or itemId (z.enum of real ids),
    problem, suggestion, severity }.
  - The grader also flags any claim not supported by the library source bullets
    (pass the source text for comparison).
  - Show the grade on the resume, with issues listed next to the bullets they refer to.

6b — Revise loop
  - "Improve" button: the revise call receives the resume, the issues, and the
    source library bullets. It may only use facts from the source bullets.
    Output: edits by bullet id. Apply as a NEW resume version (keep the old one).
  - Re-grade after revising. Stop when the overall grade reaches a target (config),
    stops improving, or after 2 rounds, whichever is first. Show what changed (diff).
  - The user can accept, reject, or edit each change.

At the end, update CLAUDE.md.
```

**You check:**
- Grade the same resume twice. The keyword score is identical; the AI grade is the same or within one step.
- Revisions never introduce a number or technology that isn't in your library.

---

## Stage 7 — Resume collection, versions, downloads

```text
Read CLAUDE.md first. This is Stage 7: a "My Resumes" page to select, view, and
download every resume, organized by job posting, with versions and status.

Milestones (stop after each):

7a — Versions and status
  - Resumes get: version (per job), parentVersionId, status ("draft" | "final" |
    "applied"), appliedAt. Revisions from Stage 6 and "Duplicate" create new versions.
    These are table columns (versionNumber, to avoid clashing with content.version,
    which is the jsonb schema version).
  - An "applied" resume is read-only in the editor (Duplicate to change it).
  - Title defaults to "<roleTitle> — <companyName>" for tailored resumes and is
    editable. General resumes (no job) keep their own titles.

7b — My Resumes page
  - Grouped by job posting (one row per job, versions collapsed underneath), plus a
    "General" group for resumes with no job.
  - Each row shows title, status, latest grade, last updated. Search, filter by
    status, sort by date.
  - Actions: open, preview, download, duplicate, "tailor again" (reruns Stage 5
    recommendations against the current library), delete (with confirmation).

7c — One-click PDF download
  - Server route that renders the SAME print view as the editor (/resumes/[id]/print)
    and returns a PDF, using Playwright/headless Chromium. Choose a setup that works
    where we deploy (e.g. playwright-core + @sparticuz/chromium on Vercel) and explain
    the tradeoff before implementing. Keep the browser print option as a fallback.
  - The print view paginates in the browser (usePagination measures blocks after
    fonts load), so the headless page must wait for a ready signal: have the print
    view set data-pages-ready="true" once pages are laid out, and wait for that
    selector instead of a fixed delay.
  - The headless browser has no user session. The route checks ownership, then
    passes a short-lived signed render token (HMAC with a server secret, bound to
    resume id + user id, ~60 s expiry) that the print route accepts instead of a
    session.
  - Filename: "<First>_<Last>_<Company>_Resume.pdf" (or "<First>_<Last>_Resume.pdf"
    with no job), with characters that aren't allowed in filenames removed.
  - Check resume ownership on every request.

7d — Copy saved on "applied"
  - When a resume is marked "applied", render the PDF once and store it in a private
    Supabase Storage bucket (key in a resumes.applied_pdf_key column). "Download" for
    applied resumes checks ownership and serves that saved file, so template changes
    never alter what was sent. Deleting the resume or account removes the file too.

At the end, update CLAUDE.md.
```

**You check:**
- The downloaded PDF matches the editor preview page for page, in both A4 and Letter.
- Text in the PDF is selectable and copies out in the right order (this is roughly what an ATS reads).
- Change the template after marking a resume applied. The applied download stays the same.
