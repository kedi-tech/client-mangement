# Client Management

A full client-management workspace (CRM) for a services business, plus a
client-facing portal.

**Your team** gets clients and their contacts, projects with budgets and
timelines, tasks, line-item invoices, notes, an activity timeline, dashboards
and reports.

**Your clients** get their own sign-in at `/portal`, where they can follow
project progress, open the live project link, read and pay attention to their
invoices, and exchange files with you — scoped so a client can only ever see
their own account.

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

Sign in with the seeded accounts — both use the same login page, and each role
lands in its own area:

| Email | Password | Lands on |
| --- | --- | --- |
| `admin@example.com` | `password123` | `/dashboard` — the admin app |
| `client@example.com` | `password123` | `/portal` — Northwind Logistics' portal |

Two additional team members (`dana@example.com`, `priya@example.com`) share the
same password so you can try owner and assignee filtering.

> Set a real `AUTH_SECRET` before deploying — it signs the session cookie.
> Generate one with `openssl rand -base64 32`.

## Upgrading an existing install

After pulling changes that touch `prisma/schema.prisma`, refresh the generated
client and the database before starting the app:

```bash
npm install          # runs prisma generate via postinstall
npm run db:push      # adds new columns and tables in place
```

Then restart the dev server — the Prisma client is loaded into memory at boot, so
a running server keeps using the old one. Skipping this produces errors like
`Unknown field 'clientId' for select statement on model 'User'`, which means the
generated client predates the schema.

`db:push` is additive for this change: existing rows are kept, the new columns
(`User.clientId`, `User.lastLoginAt`, `Project.liveUrl`) arrive as `NULL`, and the
`Attachment` table is created empty. Use `npm run db:reset` only when you want to
wipe and re-seed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run postinstall` | Regenerates the Prisma client (runs automatically on install) |
| `npm run build` | Generates the Prisma client and builds for production |
| `npm start` | Serves the production build |
| `npm test` | Unit tests for money, invoice, progress and upload logic |
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

**Files, both directions** — upload deliverables and documents for a client from
their page; clients upload to you from the portal. Every file is listed with who
sent it, an optional message, size and the related project. A staff-wide Files
inbox groups everything by client and filters by direction. Downloads stream
through an authorised route, never as static assets.

**Client portal** (`/portal`) — a separate, deliberately simple area for clients:

- **Overview** — active projects with live progress bars, balance due, amount
  past due, paid to date, invoices needing attention and recent files.
- **Projects** — progress derived from completed tasks, target dates, the
  published step list ("what's next" and "completed"), and a **Visit project**
  button pointing at the project's live URL.
- **Invoices** — every issued invoice with line items, tax and totals. Drafts are
  withheld until you send them.
- **Files** — pick up what you shared, and send files to you. A client can
  withdraw their own uploads but not yours.

**Global search** — one page across clients, contacts, projects, tasks and
invoices, including matches on the related client's name.

**Auth and roles** — email and password with bcrypt hashing and a signed,
httpOnly JWT session cookie. Three roles: `ADMIN` and `MEMBER` are your team;
`CLIENT` is a portal login tied to exactly one client. The first account to
register becomes the workspace admin; portal logins are created by staff (see
below), never by self-registration. Middleware gates every route and keeps each
role inside its own area, and each page and server action re-checks the session
independently.

### Giving a client access

Open the client, then **Portal access → Invite to portal**. Name and email are
pre-filled from the primary contact, and **Generate** produces a strong temporary
password to pass on over a channel you trust. From the same card you can reset
that password or revoke the login entirely — revoking deletes only the login, not
any client data. The card also shows whether they have ever signed in.

## Project layout

```
prisma/
  schema.prisma          Data model
  seed.ts                Demo dataset
src/
  app/
    (auth)/              Sign in and registration
    (app)/               Staff shell — sidebar, header, all admin pages
      dashboard/  clients/  contacts/  projects/  tasks/  invoices/
      files/  reports/  search/
    portal/              Client-facing area (own layout and nav)
      projects/  invoices/  files/
    api/files/[id]/      Authorised file download
  components/            UI primitives, sidebar, filters, shared rows
  lib/
    auth-token.ts        JWT sign/verify + role routing (edge-safe: no Node or
                         Prisma imports, so middleware can use it)
    session.ts           Password hashing, cookie session, requireUser() and
                         requirePortalUser()
    constants.ts         Status vocabularies and badge styling
    form-defaults.ts     Form value shapes shared by server and client modules
    format.ts            Money, date and relative-time formatting
    invoice.ts           Totals, derived status, numbering
    progress.ts          Task counts → client-facing project progress
    upload-rules.ts      Size cap, type allowlist, filename sanitising (pure)
    storage.ts           Disk writes/reads for uploads (server-only)
    validation.ts        Zod schemas for every form
    db.ts                Prisma client singleton
  server/
    actions/             Server Actions (auth, clients, contacts, projects,
                         tasks, invoices, files, portal-access)
    queries.ts           Dashboard, reporting and portal reads
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
  client removes its contacts, projects, tasks, invoices, notes, files and
  portal logins.
- **Portal isolation is enforced on the server, per query.**
  `requirePortalUser()` returns a user whose `clientId` is guaranteed, and every
  portal read filters on it — a client following a guessed project or invoice id
  gets a 404, not someone else's data. Portal uploads take the client id from the
  session and ignore anything in the form.
- **Files are never public.** Bytes live outside the served tree (`./uploads` by
  default, `UPLOAD_DIR` to relocate) under randomised names; `/api/files/[id]`
  authorises each request, and unauthorised ids 404 rather than 403 so the
  endpoint leaks nothing. Uploads are limited to 25 MB and an extension + MIME
  allowlist, and only PDFs and raster images may render inline — SVG is always
  downloaded, since an inline SVG could run script on this origin.
- **Drafts stay internal.** The portal withholds `DRAFT` invoices, so an invoice
  becomes visible to the client when you mark it sent.

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

## Deployment notes

Two things need to survive a restart: the database and the uploads directory. On
SQLite that means a persistent volume for both — set `DATABASE_URL` and
`UPLOAD_DIR` to paths on it. On a platform with an ephemeral filesystem, move the
database to Postgres (above) and reimplement the three functions in
`src/lib/storage.ts` against object storage; nothing else touches the disk.

## Testing

`npm test` covers the logic where a silent error would be most expensive: money
parsing and formatting, invoice totals and rounding, derived invoice status,
invoice numbering, project-progress maths, role routing, and the upload policy
(filename sanitising, type allowlist, inline-render rules). `npm run typecheck`
and `npm run build` cover the rest.
