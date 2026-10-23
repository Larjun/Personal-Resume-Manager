# Personal-Resume-Builder

Resume builder with structured editing, a print-accurate paginated preview, and PDF export via the browser.

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL to your Supabase connection string
npm run db:migrate   # creates the resumes table
npm run seed         # imports seed/resume.pdf as a sample resume
npm run dev
```

See [CLAUDE.md](CLAUDE.md) for architecture, stage plan, and conventions.
