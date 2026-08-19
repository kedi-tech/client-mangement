# KediClient

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
Postgres. Ships with a Dockerfile and a Compose stack, so a deployment is one
command.

---

## Quick start

The fastest path is Docker — it brings up Postgres alongside the app:

```bash
cp .env.example .env      # set AUTH_SECRET and POSTGRES_PASSWORD
docker compose up -d --build
```

Or run it locally against your own Postgres:

```bash
npm install
cp .env.example .env      # point DATABASE_URL at your server, set AUTH_SECRET
npm run setup             # generate client + apply migrations + seed demo data
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

> The seed is demo data: it **clears every table** before writing. Never run it
> against a database holding real records.

> Set a real `AUTH_SECRET` before deploying — it signs the session cookie.
> Generate one with `openssl rand -base64 32`. See [Deploying](#deploying).

## Changing the database schema

Schema changes go through versioned migrations in `prisma/migrations`, never
`prisma db push`. After editing `prisma/schema.prisma`:

```bash
npm run db:migrate:dev    # writes a new migration and applies it locally
```

Commit the generated folder. Deployments apply it automatically on boot, and CI
fails if the schema and the migrations have drifted apart.

Restart the dev server afterwards — the Prisma client is loaded into memory at
boot, so a running server keeps using the old one. Skipping that produces errors
like `Unknown field 'sessionsValidFrom' for select statement on model 'User'`,
which means the generated client predates the schema.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Generates the Prisma client and builds for production |
| `npm start` | Serves the production build |
| `npm run check` | Typecheck, lint and test — what CI runs |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including type-aware rules |
| `npm test` | Unit tests (money, invoices, progress, uploads, env, sessions) |
| `npm run setup` | Generate the client, apply migrations, seed demo data |
| `npm run db:migrate` | `prisma migrate deploy` — apply committed migrations (production) |
| `npm run db:migrate:dev` | Author a new migration after editing the schema |
| `npm run db:seed` | Re-seed demo data (clears the tables it owns first) |
| `npm run db:reset` | Drop, re-migrate and re-seed — destroys all data |
| `npm run superadmin` | Create or promote the workspace super admin (reads .env) |
| `npm run db:studio` | Prisma Studio |
| `npm run postinstall` | Regenerates the Prisma client (runs automatically on install) |

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

**Files, both directions** — any staff account (owner, admin or member) can
share deliverables and documents with a client, either from that client's page
or from the workspace-wide **Files** page, which asks which client the file is
for and narrows the project list to match. Clients upload to you from the
portal. Every file is listed with who sent it, an optional message, size and the
related project; the Files page groups everything by client and filters by
direction. Downloads stream through an authorised route, never as static assets.

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
- **Account** (`/portal/account`) — their own sign-in details, and a form to
  change their password without going through you. The current password is
  required, and a change signs them out of every *other* device while keeping
  them signed in on the one they used.

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
.github/workflows/       CI: check, migrate, build image, boot the stack
scripts/
  ensure-superadmin.ts    Creates or promotes the workspace owner
prisma/
  migrations/            Versioned schema history, applied on deploy
  schema.prisma          Data model
  seed.ts                Demo dataset
Dockerfile               Multi-stage production image (non-root, standalone)
docker-compose.yml       App + Postgres + volumes
docker-entrypoint.sh     Applies migrations, then starts the server
src/
  app/
    (auth)/              Sign in and registration
    (app)/               Staff shell — sidebar, header, all admin pages
      dashboard/  clients/  contacts/  projects/  tasks/  invoices/
      files/  reports/  search/  team/  oversight/
    portal/              Client-facing area (own layout and nav)
      projects/  invoices/  files/  account/
    api/files/[id]/      Authorised file download
    api/health/          Liveness probe (the only route open to anonymous)
    robots.ts            Disallow all — nothing here should be indexed
  components/            UI primitives, sidebar, filters, shared rows
  lib/
    auth-token.ts        JWT sign/verify, role routing, session revocation
                         (edge-safe: no Node or Prisma imports, so middleware
                         can use it)
    session.ts           Password hashing, cookie session, requireUser(),
                         requireAdmin(), requireSuperAdmin(), requirePortalUser()
    env.ts               Configuration validation (edge-safe)
    rate-limit.ts        Sign-in throttling, per email and per IP (server-only)
    constants.ts         Status vocabularies, role hierarchy, badge styling
    form-defaults.ts     Form value shapes shared by server and client modules
    format.ts            Money, date, relative-time and retry-after formatting
    invoice.ts           Totals, derived status, numbering
    progress.ts          Task counts → client-facing project progress
    search.ts            Case-insensitive `contains` filter for search boxes
    upload-rules.ts      Size cap, type allowlist, filename sanitising (pure)
    storage.ts           Disk writes/reads for uploads (server-only)
    validation.ts        Zod schemas for every form
    db.ts                Prisma client singleton
  server/
    actions/             Server Actions (auth, account, clients, contacts,
                         projects, tasks, invoices, files, portal-access, team)
    queries.ts           Dashboard, reporting, portal and oversight reads
    registration.ts      Whether /register is still open
    activity.ts          Activity-feed writer
  instrumentation.ts     Validates configuration once, at server start
  middleware.ts          Route gate and per-request CSP nonce
tests/                   Unit tests
```

## Design notes

- **Money is stored as integer cents** (`budgetCents`, `unitPriceCents`) so
  arithmetic never drifts. Parsing and formatting live in `src/lib/format.ts`.
- **Text search goes through one helper.** `like()` in `src/lib/search.ts` sets
  `mode: "insensitive"`, because Prisma's plain `contains` compiles to `LIKE`,
  which Postgres evaluates case-sensitively — searching "acme" would otherwise
  miss a client named "Acme".
- **Statuses are strings, not database enums**, so adding a value is a code change
  rather than a migration. `src/lib/constants.ts` is the single source of truth
  for the allowed values and their badge colours.
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

## Deploying

Docker, behind your own TLS terminating reverse proxy. Two supported shapes:

| | Database | Compose file |
| --- | --- | --- |
| **Neon** (recommended) | Managed, off this host | `docker-compose.neon.yml` |
| **Self-hosted** | Postgres container + volume | `docker-compose.yml` |

Either way the app comes up on `127.0.0.1:3000` (change with `APP_PORT`), bound
to loopback on purpose — put nginx, Caddy or Traefik in front of it and terminate
TLS there. **Sign-in does not work over plain HTTP**: the session cookie is
marked `secure`, so the browser will refuse to store it.

On boot the container runs `prisma migrate deploy` before starting the server,
retrying while the database becomes reachable. `migrate deploy` only plays
committed migrations forward — it never generates, resets or drops anything — so
it is safe to run on every restart and on every replica.

### Using Neon

Neon is the expected production database. Two connection strings are needed,
both from the Neon console under **Connection Details**:

| Variable | Which string | Used by |
| --- | --- | --- |
| `DATABASE_URL` | **Pooled** — host contains `-pooler` | Every query the app runs |
| `DATABASE_URL_UNPOOLED` | **Direct** — same host without `-pooler` | `prisma migrate deploy` only |

```bash
DATABASE_URL="postgresql://…@ep-name-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
DATABASE_URL_UNPOOLED="postgresql://…@ep-name-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

Why two? Neon's pooled endpoint is PgBouncer in **transaction mode**. It cannot
hold the session-level advisory lock Prisma Migrate takes, and it discards the
prepared statements DDL depends on — so `migrate deploy` through the pooler
hangs or fails, usually only on deploy. `directUrl` in `prisma/schema.prisma`
routes migrations around it. This is not a Prisma <5.10 workaround; it still
applies on Prisma 6.

The boot-time environment check refuses to start if `DATABASE_URL_UNPOOLED` is
missing or points at a pooled endpoint, and warns if a Neon URL omits
`sslmode=require`. Those are the two mistakes that otherwise surface as a hung
deploy.

Then deploy without a Postgres container:

```bash
docker compose -f docker-compose.neon.yml up -d --build
```

That stack has no `db` service and no database volume. Migrations still run on
boot, through the direct URL.

**Uploaded files still live on disk**, in the `uploads` volume — Neon holds the
database, not your files. That volume is the one thing left to back up. Moving
the app to a platform with an ephemeral filesystem means reimplementing
`saveUpload`, `uploadPath` and `deleteUpload` in `src/lib/storage.ts` against
object storage; nothing else touches the disk.

Two Neon details worth knowing: free-tier projects **scale to zero**, so the
first request after an idle period pays a cold start (hence the longer
healthcheck `start_period` and `connect_timeout=15`); and a paused project
returns connection errors, which `/api/health` reports as `503`.

### Latency

Every query costs one network round trip, so **pick a Neon region close to
wherever the app runs** — that single choice dominates everything else. Measured
from a machine in West Africa: `us-east-2` 200ms, `eu-west-2` (London) 94ms.
The region cannot be changed after a project is created; make a new project and
re-run `npm run db:migrate && npm run superadmin`.

**Do not set `pgbouncer=true` on the Neon URL.** Prisma's generic advice for
transaction-mode poolers is to add it, but Neon's pooler supports prepared
statements. The flag makes Prisma disable them and measured **5x slower**:
1084ms vs 218ms for a warm `SELECT 1`. Verified safe to omit with 480
concurrent queries across 4 clients and zero prepared-statement errors.

A page is several round trips, not one: Prisma issues a separate query per
`include`, and a child query cannot start until its parent returns. The
dashboard is 15 statements. If pages still feel slow after the region move, the
next lever is Prisma's `relationJoins` preview feature, which folds `include`s
into a single SQL join.

### Self-hosting Postgres instead

`docker-compose.yml` brings up Postgres alongside the app, with the database in a
`db-data` volume on the host:

```bash
cp .env.example .env
# Set at minimum:
#   AUTH_SECRET       openssl rand -base64 32
#   POSTGRES_PASSWORD a password you did not reuse
docker compose up -d --build
```

It sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the same connection, since
there is no pooler in that stack. You own backups, upgrades and disk for both
volumes.

### What must survive a redeploy

| State | Where it lives | Kept by |
| --- | --- | --- |
| Database (Neon) | Neon, off this host | Neon's own backups / branches |
| Database (self-hosted) | Postgres container | the `db-data` volume |
| Uploaded files | `UPLOAD_DIR` (`/data/uploads`) | the `uploads` volume — **both setups** |

Everything else in the container is disposable. Note that Neon takes the database
off your host but **not the files**: an `Attachment` row whose bytes are missing
renders as a broken download, so back the `uploads` volume up alongside whatever
covers the database, and restore them together.

### Behind a reverse proxy

Forward the real client address, and **overwrite** rather than append it —
`clientIp()` reads the first `X-Forwarded-For` entry, which a client can
otherwise forge to dodge the per-IP sign-in throttle. The per-email throttle does
not depend on it, so a forged header still cannot brute force one account.

```nginx
proxy_set_header X-Forwarded-For $remote_addr;   # not $proxy_add_x_forwarded_for
proxy_set_header X-Real-IP       $remote_addr;
proxy_set_header Host            $host;
```

Point health checks at `GET /api/health`. It returns `200` with
`{"status":"ok"}` when the database is reachable and `503` otherwise, and is the
only route reachable without a session.

### Going live checklist

- [ ] `AUTH_SECRET` is a fresh 32+ character random value, not the example one.
      Changing it later signs everyone out — which is also the fastest way to
      revoke every session at once.
- [ ] `POSTGRES_PASSWORD` is set and not reused elsewhere.
- [ ] `ALLOW_OPEN_REGISTRATION` is **unset**. The app refuses to start in
      production if it is on.
- [ ] TLS terminates in front of the app, and HTTP redirects to HTTPS.
- [ ] The first admin has registered, closing `/register` (see below).
- [ ] Both volumes are included in your backups, and a restore has been tested.
- [ ] The demo seed has **not** been run against the real database — it clears
      every table first.

### Roles

| Role | Client data | Creates clients | Grants portal access | Manages accounts | Oversight |
| --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | Full | Yes | Yes | Admins and members | Yes |
| `ADMIN` | Full | Yes | Yes | Members only | No |
| `MEMBER` | Full | Yes | Yes | No | No |
| `CLIENT` | Own portal only | — | — | — | — |

Account administration compares **rank**, never a named role: you may only act on
someone strictly below you. That single rule gives three guarantees at once — an
admin cannot touch another admin, nobody can demote or delete the super admin, and
nobody can act on their own account. It is enforced in the server actions, not just
hidden in the UI, and the roles offered in a dropdown are likewise limited to those
below the actor, so an admin can never mint a peer.

There is deliberately no way to promote anyone to `SUPER_ADMIN` through the app.

### Oversight (`/oversight`)

A super-admin-only view of what the admins and their teams have been doing. It
reads the append-only activity log that every server action already writes to, so
it is strictly read-only — nothing on the page can change data.

- **Summary** for the window: actions logged, how many staff were active,
  account &amp; access changes, and deletions.
- **The team** — every staff account with its role, action count, last action and
  last sign-in. Click a name to filter the feed to that person.
- **Activity** — the feed itself, filterable by period, person and category, and
  paginated.

Entries are bucketed by how much they would matter if it were not you who did
them: **Accounts & access** (roles, password resets, portal access), then
**Deletions**, then **Files** and routine **Client work**.

Admins cannot see this page — it deliberately spans their own actions.

### Creating the super admin

Set the credentials in `.env` (which is gitignored — never commit a password):

```bash
SUPERADMIN_EMAIL="owner@example.com"
SUPERADMIN_PASSWORD="a long password you have not reused"
SUPERADMIN_NAME="Super Admin"
```

```bash
npm run superadmin
```

Idempotent and safe against a live database: it creates the account, or promotes an
existing one, and touches exactly one row. A re-run will **not** reset the password
unless you also set `SUPERADMIN_RESET_PASSWORD=true` — so a deploy that re-runs it
cannot silently reset a live credential. Changing the password signs that account
out everywhere.

`npm run db:seed` preserves `SUPER_ADMIN` accounts while clearing the rest, so
re-seeding demo data will not lock you out.

### Creating accounts

`/register` is open only until the first staff account exists; that account
becomes the workspace `ADMIN`. The sign-in page carries no "create account"
link — there is nothing for a visitor to sign up to. After that the route closes and returns
"Sign-up is closed", because an open sign-up form would hand any visitor a
`MEMBER` account with access to every client record.

Admins add teammates from **/team**, which also handles role changes, password
resets and removal. It refuses any change that would leave the workspace with no
administrator. Client portal logins are separate and are created from each
client's page.

## Security

What was hardened for production, and where it lives:

| Concern | Approach | Where |
| --- | --- | --- |
| Session theft after a password change | Tokens carry `iat`; accounts carry `sessionsValidFrom`. A reset, a role change or an admin action bumps it and every existing cookie stops working. | `src/lib/auth-token.ts`, `src/lib/session.ts` |
| Password guessing | Failed sign-ins are counted per email *and* per IP in the database, so counters survive restarts and are shared across replicas. The self-service password change shares those counters, so a stolen session cannot be used as an unlimited oracle for the current password. | `src/lib/rate-limit.ts`, `src/server/actions/account.ts` |
| Account enumeration | Unknown emails are compared against a dummy bcrypt hash, so the response takes the same time as a wrong password, and the message is identical. | `src/server/actions/auth.ts` |
| Privilege escalation | Account changes compare rank, so an admin cannot promote a member to admin, touch a peer, or act on the super admin. Checked in the actions, not only in the UI. | `src/lib/constants.ts`, `src/server/actions/team.ts` |
| Open sign-up | Closes automatically once an admin exists; the server action re-checks, since the page guard alone would not stop a direct call. | `src/server/registration.ts` |
| XSS | Per-request nonce with `strict-dynamic`; an injected `<script>` cannot run even if escaping were bypassed. | `src/middleware.ts` |
| Clickjacking, sniffing, referrer leakage | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS in production. | `next.config.ts` |
| Misconfiguration | Every required variable is validated once at boot, reporting all problems at once, so a bad deploy fails immediately rather than at first login. | `src/lib/env.ts`, `src/instrumentation.ts` |
| Malicious uploads | Extension + MIME allowlist, 25 MB cap, randomised names on disk, authorised streaming downloads, SVG never rendered inline. | `src/lib/upload-rules.ts`, `src/lib/storage.ts` |
| Cross-tenant reads | Portal queries are scoped by the session's `clientId`, never by a form field. | `src/lib/session.ts` |

Dependency vulnerabilities are checked in CI with `npm audit --omit=dev
--audit-level=high`. Two transitive advisories (`postcss`, `sharp`) are resolved
by the `overrides` block in `package.json` rather than by a breaking upgrade to
Next 16 — revisit it whenever Next.js is bumped.

### Known limits

- **Staff see every client.** `SUPER_ADMIN`, `ADMIN` and `MEMBER` all read and
  edit all client data; the role hierarchy governs *account administration*
  only. There is no per-client access control for staff.
- **Uploads are on local disk.** Fine for one container with a volume. Running
  more than one app replica means putting the files on shared storage, or
  reimplementing `saveUpload`, `uploadPath` and `deleteUpload` in
  `src/lib/storage.ts` against object storage — nothing else touches the disk.
- **No email.** Passwords for new teammates and portal users are set by an admin
  and handed over out of band. A signed-in client can change their own password
  at `/portal/account`, but someone who has *forgotten* theirs still needs an
  admin to reset it — a "forgot password" link needs an email provider.

## Testing

```bash
npm run check     # typecheck + lint + tests
```

`npm test` covers the logic where a silent error would be most expensive: money
parsing and formatting, invoice totals and rounding, derived invoice status,
invoice numbering, project-progress maths, role routing, the upload policy
(filename sanitising, type allowlist, inline-render rules), environment
validation, session-revocation timing and throttle messages.

CI additionally applies the migrations to a real Postgres, fails if
`prisma/schema.prisma` has drifted from `prisma/migrations`, builds the
production image, and boots the whole compose stack until `/api/health` answers.
