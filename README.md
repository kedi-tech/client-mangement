# Client Management

A full client-management workspace (CRM) for a services business: clients and
their contacts, projects with budgets and timelines, tasks, line-item invoices,
notes, an activity timeline, dashboards and reports.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Prisma and
SQLite. No external services are required to run it.

---

## Quick start

```bash
npm install
cp .env.example .env      # then edit AUTH_SECRET
npm run setup             # prisma generate + db push + seed demo data
npm run dev               # http://localhost:3000
```

Sign in with the seeded account:

| Email | Password |
| --- | --- |
| `admin@example.com` | `password123` |

Two additional team members (`dana@example.com`, `priya@example.com`) share the
same password so you can try owner and assignee filtering.

> Set a real `AUTH_SECRET` before deploying — it signs the session cookie.
> Generate one with `openssl rand -base64 32`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Generates the Prisma client and builds for production |
| `npm start` | Serves the production build |
| `npm test` | Unit tests for the money and invoice logic |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup` | Generate client, sync the schema, seed demo data |
| `npm run db:push` | Sync the schema to the database without a migration |
| `npm run db:seed` | Re-seed demo data (clears the tables it owns first) |
| `npm run db:reset` | Force-reset the schema, then re-seed |
| `npm run db:studio` | Prisma Studio |

## Features

**Dashboard** — active clients, active projects, outstanding and overdue money,
a six-month collected-revenue chart, upcoming and overdue tasks, invoices that
need chasing, the newest clients and a live activity feed.

**Clients** — full CRUD with status (lead / active / inactive / archived),
account owner, industry, address, internal notes, and per-client rollups of
billed, collected and outstanding revenue. Search across name, company, email,
industry and city; filter by status and owner; sort and paginate.

**Contacts** — many per client, with a designated primary contact (setting one
demotes the rest). Browsable and searchable across all accounts.

**Projects** — scoped to a client, with status, budget, start and end dates,
task-completion progress and a budget-used bar comparing invoiced value against
the budget.

**Tasks** — status, priority, due date, assignee, and optional links to a client
and project. One-click complete/reopen from the dashboard, the task list, and
the client and project pages. Overdue work is called out everywhere.

**Invoices** — line items with quantity and unit price, a tax rate, live totals
while you type, and a printable-style detail view. Status shortcuts (mark sent,
mark paid, void, reopen). Overdue is derived from the due date rather than
stored, so it is never stale. Invoice numbers auto-increment and are unique.

**Notes and activity** — free-form notes per client and an append-only activity
timeline recording creations, status changes, notes and completions.

**Reports** — billed / collected / outstanding totals, collection rate, average
invoice value, top clients by revenue, project pipeline by status with budget
sums, delivery progress and revenue by industry.

**Global search** — one page across clients, contacts, projects, tasks and
invoices, including matches on the related client's name.

**Auth** — email and password with bcrypt hashing and a signed, httpOnly JWT
session cookie. The first account to register becomes the workspace admin.
Middleware gates every app route; each page and server action re-checks the
session independently.

## Project layout

```
prisma/
  schema.prisma          Data model
  seed.ts                Demo dataset
src/
  app/
    (auth)/              Sign in and registration
    (app)/               Authenticated shell — sidebar, header, all app pages
      dashboard/  clients/  contacts/  projects/  tasks/  invoices/
      reports/  search/
  components/            UI primitives, sidebar, filters, shared rows
  lib/
    auth-token.ts        JWT sign/verify (edge-safe, no Node or Prisma imports)
    session.ts           Password hashing, cookie session, requireUser()
    constants.ts         Status vocabularies and badge styling
    form-defaults.ts     Form value shapes shared by server and client modules
    format.ts            Money, date and relative-time formatting
    invoice.ts           Totals, derived status, numbering
    validation.ts        Zod schemas for every form
    db.ts                Prisma client singleton
  server/
    actions/             Server Actions (auth, clients, contacts, projects,
                         tasks, invoices)
    queries.ts           Dashboard and reporting reads
    activity.ts          Activity-feed writer
  middleware.ts          Route gate
tests/                   Unit tests
```

## Design notes

- **Money is stored as integer cents** (`budgetCents`, `unitPriceCents`) so
  arithmetic never drifts. Parsing and formatting live in `src/lib/format.ts`.
- **Statuses are strings, not database enums**, because SQLite has no enum type.
  `src/lib/constants.ts` is the single source of truth for the allowed values
  and their badge colours.
- **Overdue is computed, not stored.** `effectiveInvoiceStatus()` derives it
  from the due date, so an invoice cannot sit in a stale state.
- **Mutations are Server Actions**, validated with Zod on the server; the same
  schemas produce the field-level error messages the forms render.
- **Form defaults live outside `"use client"` modules.** A plain object imported
  from a client module into a Server Component arrives as a client-reference
  proxy rather than the value itself, silently blanking every default — hence
  `src/lib/form-defaults.ts`.
- **Deletes cascade** along the relations declared in the schema: removing a
  client removes its contacts, projects, tasks, invoices and notes.

## Switching to Postgres

Every model is provider-agnostic. To move off SQLite:

1. In `prisma/schema.prisma`, set `provider = "postgresql"`.
2. Point `DATABASE_URL` at your server.
3. Run `npm run db:push` (or `npx prisma migrate dev` to start a migration
   history), then `npm run db:seed`.

One query detail: Prisma's case-insensitive `mode: "insensitive"` is
Postgres-only. Searches currently use plain `contains`, which SQLite's `LIKE`
already treats case-insensitively for ASCII. On Postgres, add
`mode: "insensitive"` to the search filters in the list pages to keep the same
behaviour.

## Testing

`npm test` covers money parsing and formatting, invoice totals and rounding,
derived invoice status and invoice numbering — the logic where a silent error
would be most expensive. `npm run typecheck` and `npm run build` cover the rest.
