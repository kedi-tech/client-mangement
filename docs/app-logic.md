# KediClient — complete application logic

Every rule, calculation, permission and screen behaviour in the app, written
for designing the UI. This was compiled by reading every file in `src/`,
`prisma/schema.prisma` and `scripts/`.

**Contents**

1. [The two apps](#1-the-two-apps)
2. [Data model](#2-data-model)
3. [Status lifecycles](#3-status-lifecycles)
4. [Roles and permissions](#4-roles-and-permissions)
5. [Sign-in, sign-up and sessions](#5-sign-in-sign-up-and-sessions)
6. [Routing and redirects](#6-routing-and-redirects)
7. [Calculations](#7-calculations)
8. [Admin app: screen by screen](#8-admin-app-screen-by-screen)
9. [Client portal: screen by screen](#9-client-portal-screen-by-screen)
10. [Forms and validation rules](#10-forms-and-validation-rules)
11. [Files](#11-files)
12. [Activity log](#12-activity-log)
13. [Search, filters and pagination](#13-search-filters-and-pagination)
14. [Formatting rules](#14-formatting-rules)
15. [System behaviour](#15-system-behaviour)
16. [Command-line scripts](#16-command-line-scripts)
17. [Gaps and quirks worth designing around](#17-gaps-and-quirks-worth-designing-around)

---

## 1. The two apps

One codebase serves two separate experiences:

| | Admin app | Client portal |
| --- | --- | --- |
| Who | Staff: `SUPER_ADMIN`, `ADMIN`, `MEMBER` | Customers: `CLIENT` |
| Where | `/dashboard`, `/clients`, `/contacts`, `/projects`, `/tasks`, `/invoices`, `/files`, `/reports`, `/search`, `/team`, `/oversight` | `/portal`, `/portal/projects`, `/portal/invoices`, `/portal/files`, `/portal/account` |
| Layout | Left sidebar + top bar with "Search everything", user name, Sign out | Top header with client name, user name, Sign out; tab bar below; footer with account manager |
| Scope | Every client in the workspace | Only their own client |

Both use the same sign-in page (`/login`). After sign-in, staff land on
`/dashboard` and clients land on `/portal`.

Product name in the UI: **KediClient**.

---

## 2. Data model

All money is stored as **integer cents**. All IDs are random strings (cuid).

### 2.1 User (one table for staff and clients)

| Field | Notes |
| --- | --- |
| email | Unique across everyone, staff and clients. Stored lowercase. |
| name | |
| passwordHash | bcrypt, cost 10 |
| role | `SUPER_ADMIN`, `ADMIN`, `MEMBER` or `CLIENT`. Default `MEMBER`. |
| clientId | Only for `CLIENT` users: which client they belong to. |
| lastLoginAt | Set on every successful sign-in. Shown as "Last sign-in". |
| sessionsValidFrom | Any session issued before this time is rejected. Used to sign people out everywhere. |
| createdAt / updatedAt | |

A user can be: owner of many clients, assignee of many tasks, author of notes,
actor in activity, uploader of files.

### 2.2 Client

| Field | Notes |
| --- | --- |
| name | Required, max 160 chars |
| company, email, phone, website, industry | Optional |
| status | `LEAD` (default), `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| addressLine, city, state, postalCode, country | Optional |
| notes | Internal notes (single free-text field, different from the Notes log) |
| ownerId | Staff member responsible. Optional. |

Has many: contacts, projects, invoices, tasks, notes (log), activity entries,
files, portal users.

### 2.3 Contact

Belongs to one client. Fields: firstName, lastName (both required, max 80),
email, phone, title, `isPrimary` (yes/no).

**Rule:** at most one primary contact per client. Saving a contact as primary
un-primaries every other contact of that client.

### 2.4 Project

Belongs to one client. Fields: name (required, max 160), description, status
(`PLANNING` default, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`),
budgetCents (default 0), startDate, endDate, liveUrl ("Visit project" link).

Has many tasks, invoices and files.

### 2.5 Task

Fields: title (required, max 200), description, status (`TODO` default,
`IN_PROGRESS`, `DONE`), priority (`LOW`, `MEDIUM` default, `HIGH`), dueDate,
completedAt, clientId (optional), projectId (optional), assigneeId (optional).

A task can be linked to: a project (and therefore its client), a client only,
or nothing at all.

### 2.6 Invoice and invoice lines

| Invoice field | Notes |
| --- | --- |
| number | Unique, max 40 chars, e.g. `INV-1001` |
| clientId | Required |
| projectId | Optional; must belong to the same client |
| status | Stored: `DRAFT` (default), `SENT`, `PAID`, `OVERDUE`, `VOID` |
| issueDate | Default: now |
| dueDate | Required in DB; defaults to issue date + 30 days |
| paidAt | Set when marked paid |
| taxRate | Percent, 0–100, decimals allowed (e.g. 8.5) |
| notes | Optional, printed on invoice |

Each line: description (required, max 200), quantity (> 0, decimals allowed),
unitPriceCents, position (display order).

### 2.7 Note

Belongs to a client. Fields: body (1–5000 chars), author (staff user),
createdAt. Staff only — never shown in the portal.

### 2.8 Attachment (file)

| Field | Notes |
| --- | --- |
| clientId | Required |
| projectId | Optional; must belong to the same client |
| filename | Cleaned original name, used for download |
| storedName | Random name on disk |
| mimeType, sizeBytes | |
| uploadedBy | `STAFF` (shared by team) or `CLIENT` (sent from portal) |
| uploaderId | Who uploaded |
| note | Optional message, max 500 chars |

### 2.9 Activity

Append-only log. Fields: type, message (human sentence), clientId (optional),
actorId, entityType, entityId, createdAt. See [section 12](#12-activity-log).

### 2.10 LoginAttempt

One row per failed sign-in, keyed `email:<address>` and `ip:<address>`. Used
only for throttling.

### 2.11 What happens on delete

| Deleted | Also deleted | Kept but unlinked (set to empty) |
| --- | --- | --- |
| **Client** | contacts, projects, tasks, invoices (+ lines), notes, files records, activity for that client, **portal logins** | — |
| **Project** | its tasks | invoices and files lose their project link |
| **Invoice** | its lines | — |
| **Staff user** | — | owned clients become "Unassigned", tasks become "Unassigned", notes show author "Unknown", activity shows "System" / "A removed account", files lose uploader |
| **Portal user** (revoke) | — | client data untouched |

When a client is deleted, file **records** go, but the files themselves stay on
disk. Deleting a single file removes both.

---

## 3. Status lifecycles

### 3.1 Client status

`LEAD` → `ACTIVE` → `INACTIVE` → `ARCHIVED`. There are no enforced transitions:
any status can be picked from the edit form at any time. A status change logs
`CLIENT_STATUS_CHANGED` ("X moved from LEAD to ACTIVE"). Other edits log
`CLIENT_UPDATED`.

### 3.2 Project status

`PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`. Free choice in the
edit form. A change logs `PROJECT_STATUS_CHANGED`.

### 3.3 Task status

`TODO`, `IN_PROGRESS`, `DONE`.

- **Checkbox toggle** (task list, dashboard, client page, project page):
  - not done → `DONE`, sets completedAt = now, logs `TASK_COMPLETED`
  - done → `TODO` (not back to IN_PROGRESS), clears completedAt, no log
- **Edit form:** choosing DONE keeps the original completedAt if it already had
  one, else sets now. Any other status clears completedAt.
- **Create form:** creating as DONE sets completedAt = now.
- **Overdue** = not DONE and dueDate is in the past. Not stored; computed live.

### 3.4 Invoice status

Stored values: `DRAFT`, `SENT`, `PAID`, `OVERDUE`, `VOID`.

**Effective status** (what is shown everywhere):

```
if stored is PAID, VOID or DRAFT  → show stored
else if dueDate < now             → OVERDUE
else                              → stored (SENT, or OVERDUE if someone picked it)
```

So a SENT invoice becomes OVERDUE automatically once its due date passes,
without anyone editing it.

**Outstanding** = effective status is SENT or OVERDUE.

**Quick buttons on the invoice detail page:**

| Button | Shown when | Result |
| --- | --- | --- |
| Mark sent | stored status is DRAFT (and not paid/void) | status SENT |
| Mark paid | effective status is not PAID and not VOID | status PAID, paidAt = existing paidAt or now |
| Void invoice | effective status is not VOID | status VOID, paidAt cleared |
| Reopen as draft | effective status is VOID | status DRAFT, paidAt cleared |
| Delete | always | confirm, then permanent delete |

Every quick button logs `INVOICE_STATUS_CHANGED` ("Invoice INV-1001 was marked
paid"). The quick-button action only accepts DRAFT, SENT, PAID, VOID.

In the full edit form, any of the 5 statuses can be chosen (including OVERDUE).
paidAt: kept if already set and status is PAID, set to now if newly PAID,
cleared otherwise.

**Portal visibility:** DRAFT invoices are hidden from clients completely
(lists, totals, detail page returns 404). An invoice appears in the portal the
moment it is no longer DRAFT.

---

## 4. Roles and permissions

### 4.1 Rank

| Role | Rank |
| --- | --- |
| SUPER_ADMIN | 3 |
| ADMIN | 2 |
| MEMBER | 1 |
| CLIENT | 0 |

- **"Admin role"** = rank ≥ 2 (SUPER_ADMIN or ADMIN).
- **Can manage someone** = your rank is **strictly higher** than theirs.
- **Roles you can hand out** = staff roles strictly below yours. Super admin can
  give ADMIN or MEMBER. Admin can give MEMBER only. Member: none.
- SUPER_ADMIN can never be assigned in the app (it is not below anyone).

### 4.2 Full permission matrix

| Capability | Super admin | Admin | Member | Client |
| --- | --- | --- | --- | --- |
| Dashboard, Clients, Contacts, Projects, Tasks, Invoices, Files, Reports, Search | ✔ | ✔ | ✔ | ✖ |
| Create / edit / delete clients, contacts, projects, tasks, invoices, notes | ✔ | ✔ | ✔ | ✖ |
| Share files with clients, delete any file | ✔ | ✔ | ✔ | ✖ |
| Grant / reset / revoke portal access | ✔ | ✔ | ✔ | ✖ |
| `/team` page | ✔ | ✔ | ✖ | ✖ |
| Add staff | ADMIN or MEMBER | MEMBER | ✖ | ✖ |
| Change a staff role | of admins and members | of members (to member only, so effectively no-op) | ✖ | ✖ |
| Reset a staff password | admins and members | members | ✖ | ✖ |
| Remove staff | admins and members | members | ✖ | ✖ |
| See the super admin in the team list | ✔ | ✖ (hidden) | — | — |
| `/oversight` page | ✔ | ✖ | ✖ | ✖ |
| Portal pages | ✖ | ✖ | ✖ | ✔ own client only |
| Upload file in portal | — | — | — | ✔ |
| Delete a file in portal | — | — | — | own uploads only |
| Change own password | ✔ (no staff page for it yet) | ✔ (same) | ✔ (same) | ✔ `/portal/account` |

### 4.3 Safety rules on account management

1. You can't act on yourself, a peer, or anyone above you (rank rule).
2. Changing a role checks **both** the person's current role **and** the new
   role are below you.
3. **Last admin protection:** if the target is an admin-rank account and there
   is only 1 admin-rank account in total, demoting or removing them is refused:
   "This is the only administrator. Promote someone else first."
4. Changing a role signs that person out everywhere.
5. Resetting a password signs that person out everywhere.
6. All of this is checked on the server, not only hidden in the UI.

### 4.4 Important: data access is not per-client for staff

Every staff role sees and edits **all** clients. The client "owner" is only a
label and a filter, not a permission.

---

## 5. Sign-in, sign-up and sessions

### 5.1 Session

- Stored in an httpOnly cookie `cm_session`, a signed JWT (HS256) with userId,
  email, name, role, clientId.
- Lasts **7 days**. Cookie: `sameSite=lax`, `secure` in production (so sign-in
  doesn't work over plain HTTP in production).
- On every request the server re-reads the user from the database: if the user
  was deleted, or the token was issued before `sessionsValidFrom` (1 second
  tolerance), the session is invalid → treated as signed out.
- Role and clientId are taken from the database, not the token.

### 5.2 Sign in (`/login`)

Page behaviour:
- Already signed in → redirect to your home (`/dashboard` or `/portal`).
- No staff account exists yet → redirect to `/register`.
- Shows email + password. No "create account" link. Footer text: "Trouble
  signing in? Ask your administrator to reset your password."

Submit logic, in order:
1. Validate: email required and valid; password required.
2. Email lowercased.
3. **Throttle check** (see 5.5). If blocked: "Too many failed sign-in attempts.
   Try again in N minutes/seconds."
4. Unknown email → "Incorrect email or password." (same message, same timing as
   a wrong password, so nobody can tell which emails exist). Failure recorded.
5. Wrong password → same message, failure recorded.
6. Success → failures for that email cleared, session created, lastLoginAt
   updated, redirect: CLIENT → `/portal`, staff → `/dashboard`.

### 5.3 Sign up (`/register`)

- Open **only while no staff account exists** (or if
  `ALLOW_OPEN_REGISTRATION=true`, development only; the app refuses to start in
  production with it on).
- Closed → page shows "Sign-up is closed. This workspace already has an
  administrator…" with a "Back to sign in" link.
- Open → form: name (1–120), email, password (min 8), confirm password (must
  match). Text: "The first account created becomes the workspace admin."
- Submit re-checks that sign-up is open, rejects an email already in use
  ("That email is already registered.").
- First staff account → role **ADMIN**. Any later one (only possible with open
  registration) → MEMBER.
- Signs them in and redirects to `/dashboard`.

### 5.4 Sign out

Deletes the cookie, redirects to `/login`. Available in admin top bar and
portal header.

### 5.5 Throttling (brute-force protection)

- Window: **15 minutes**.
- Blocked when either: **10 failures** for the same email, or **30 failures**
  from the same IP, inside the window.
- Wait time = until the oldest counted email failure is 15 minutes old (minimum
  1 second). Shown as "N seconds" if under 90 seconds, else "N minutes" rounded up.
- Successful sign-in clears that email's failures.
- Old rows are cleaned up automatically on each check.
- The same counters apply to "change my password" (wrong current password
  counts as a failure).

### 5.6 Change own password (`/portal/account`)

Fields: current password, new password (min 8), confirm. Rules:
- New must match confirm: "Passwords do not match".
- New must differ from current: "Choose a password different from your current one".
- Throttled as above: "Too many attempts. Try again in …".
- Wrong current: "That is not your current password." (counts as a failure).
- Success: password changed, **every other device signed out**, this device
  stays signed in. Logged as `PORTAL_PASSWORD_CHANGED` (or
  `STAFF_PASSWORD_CHANGED` for staff).

The action works for staff too, but only the portal has a page for it.

### 5.7 Forgot password

There is **no** forgot-password flow and **no email sending**. A staff member
must reset the password and pass it on manually.

---

## 6. Routing and redirects

### 6.1 Edge check (every request)

| Situation | Result |
| --- | --- |
| `/api/health`, `/robots.txt` | Always allowed, no sign-in needed |
| Not signed in, any page except `/login`, `/register` | → `/login` |
| Signed in, visiting `/login` or `/register` | → home for your role |
| CLIENT visiting anything outside `/portal` (except `/api/…`) | → `/portal` |
| Staff visiting `/portal…` | → `/dashboard` |
| `/` | → home for your role, or `/login` |

### 6.2 Page-level guards (authoritative)

| Guard | Used on | Fails → |
| --- | --- | --- |
| Staff only | All admin pages and actions | not signed in → `/login`; CLIENT → `/portal` |
| Admin rank | `/team` and team actions | → `/dashboard` |
| Super admin | `/oversight` | → `/dashboard` |
| Portal user | All `/portal` pages and portal actions | not signed in → `/login`; staff or client with no clientId → `/dashboard` |

### 6.3 Sidebar navigation (admin)

Always: Dashboard, Clients, Contacts, Projects, Tasks, Invoices, Files, Reports.
Admin rank adds **Team**. Super admin adds **Oversight**.
Active item = current path equals or starts with the item's path.
On mobile the sidebar is a slide-in drawer with a menu button and backdrop.

### 6.4 Portal tabs

Overview (`/portal`, active only on exact match), Projects, Invoices, Files,
Account.

### 6.5 Not found / errors

- Unknown record or URL → 404 page: "Page not found — The record you are
  looking for may have been deleted, or the link is wrong." + "Back to dashboard".
- Unexpected error → "Something went wrong" + error message + "Try again".
- In the portal, another client's project or invoice ID returns 404 (not
  "forbidden").

---

## 7. Calculations

### 7.1 Invoice totals

```
line amount   = round(quantity × unitPriceCents)
subtotal      = sum of line amounts
tax           = round(subtotal × taxRate / 100)
total         = subtotal + tax
```

Rounding is per line, so the printed lines always add up to the subtotal. The
invoice form shows these totals live while typing.

### 7.2 Money buckets (used everywhere)

| Bucket | Which invoices (by effective status) |
| --- | --- |
| **Billed** | everything except DRAFT and VOID |
| **Collected / Paid** | PAID |
| **Outstanding** | SENT + OVERDUE |
| **Overdue** | OVERDUE |

All sums use invoice **total** (including tax).

### 7.3 Project progress (task-based)

```
total       = number of tasks on the project
done        = tasks with status DONE
inProgress  = tasks with status IN_PROGRESS
percent     = total > 0 ? round(done / total × 100) : 0
```

### 7.4 Budget used (project page)

```
invoiced    = sum of totals of the project's invoices, excluding DRAFT and VOID
budgetUsed% = budget > 0 ? min(round(invoiced / budget × 100), 999) : 0
```

The bar fills to max 100% and turns **red** when over 100%. Hidden when budget
is 0.

### 7.5 Dashboard numbers

| Number | Logic |
| --- | --- |
| Active clients | count of clients with status ACTIVE |
| Total clients | count of all clients |
| Leads | count with status LEAD |
| Active projects | count with status ACTIVE |
| In planning | count with status PLANNING |
| Outstanding | sum of outstanding invoices (compact format, e.g. $84.5K) |
| Collected to date | sum of PAID invoices |
| Overdue invoices | count of OVERDUE + sum ("$X past due"), tile turns red when > 0 |
| Overdue tasks | open tasks with dueDate before now |
| Revenue chart | last 6 calendar months including the current one; each month = sum of PAID invoice totals whose **paidAt** falls in that month |

Revenue chart bars: height = month ÷ highest month. A month with any revenue
shows at least 4% height; zero months show 1%. Caption: "Collected revenue by
month · peak $X".

### 7.6 Reports numbers

| Number | Logic |
| --- | --- |
| Billed to date | sum of every client's billed |
| Collected | sum of every client's paid |
| Collection rate | round(collected ÷ billed × 100), 0 if nothing billed |
| Outstanding | sum of every client's outstanding |
| Average invoice | sum of **all** invoice totals (including drafts and voids) ÷ number of all invoices |
| Top clients | 10 clients with highest billed |
| Pipeline | per project status: count + sum of budgets |
| Delivery | done tasks ÷ all tasks (bar + "X of Y tasks complete") |
| Revenue by industry | clients grouped by industry (blank = "Unspecified"), count + billed, sorted by billed |

Footer note: "Billed totals exclude draft and voided invoices. Overdue status is
derived from the due date."

### 7.7 Portal numbers

| Number | Logic |
| --- | --- |
| Active projects | projects with status ACTIVE |
| Balance due | outstanding (non-draft invoices); green when 0 |
| Past due | overdue sum + "past due", or "Nothing past due" |
| Paid to date | sum of PAID |

---

## 8. Admin app: screen by screen

Common pieces on admin pages: page header (title, description, optional
breadcrumb, action buttons), cards, tables, empty states with a call to action,
status badges (colour per status), and delete buttons that open a browser
confirm dialog first.

### 8.1 Top bar and layout

- "Search everything" link → `/search`.
- User's name and Sign out.
- Sidebar bottom shows user name and email.

### 8.2 Dashboard (`/dashboard`)

- Title: "Welcome back, {first name}". Actions: **New client**, **New invoice**.
- **4 stat tiles** (each is a link):
  1. Active clients → `/clients?status=ACTIVE`, sub "{total} total · {leads} leads"
  2. Active projects → `/projects?status=ACTIVE`, sub "{n} in planning"
  3. Outstanding → `/invoices?status=SENT`, sub "{collected} collected to date"
  4. Overdue invoices → `/invoices?status=OVERDUE`, sub "$X past due" or "Nothing past due", red when > 0
- **Revenue** card: 6-month bar chart, link to Reports.
- **Tasks** card: up to **8** open tasks, sorted by due date (earliest first),
  then newest. Subtitle "N overdue" or "Nothing overdue". Each row has a
  complete checkbox. Empty: "No open tasks".
- **Invoices needing attention**: up to **5** outstanding invoices, earliest due
  first: number, client, due date, total, status badge. Empty: "Nothing outstanding".
- **Recent activity**: last **10** activity entries; message (links to client
  if it has one), "{actor or System} · {relative time}".
- **Newest clients**: last **5** clients created: name, "{n} projects · {n}
  contacts", status badge. Empty state: "Add your first client".

### 8.3 Clients list (`/clients`)

- Search box: name, company, email, industry, city (case-insensitive).
- Filters: Status (Any / 4 statuses), Owner (Anyone / each staff member), Sort
  (Newest default / Name A–Z / Status).
- Table: Client (name + "industry · city"), Status, Owner ("Unassigned" if
  none), Projects count, Outstanding (sum, "—" if 0), Added (relative time).
- **12 per page**, pagination.
- Empty with filters: "No clients match those filters" + Clear filters.
  Empty without filters: "Add your first client…" + New client.

### 8.4 New / edit client (`/clients/new`, `/clients/{id}/edit`)

Fields: name*, company, email, phone, website, industry, status (default LEAD),
address line, city, state, postal code, country, internal notes, owner.

- New: owner defaults to **the current user**. If owner left empty on create,
  it is set to the current user anyway.
- Edit: owner can be cleared to "Unassigned".
- Save → redirect to the client page.

### 8.5 Client detail (`/clients/{id}`)

Header: client name, "company · industry", breadcrumb "← Clients", status badge,
buttons **New project**, **New invoice** (both pre-select this client), **Edit**.

**3 money cards:** Billed to date, Collected (green), Outstanding (red if > 0).

Main column:
1. **Contacts** — "{n} on file". Sorted primary first, then last name. Each:
   initials avatar, name, "Primary" pill, "title · email · phone", Edit, Delete
   (confirm). **Add contact** opens an inline form (first name*, last name*,
   title, email, phone, Primary checkbox).
2. **Projects** — newest first: name, "$budget budget · ends {date}", status.
3. **Invoices** — newest issue date first: number, "Issued X · due Y", total,
   effective status.
4. **Files** — "{n} shared with this client", "{n} received". File list + upload
   form ("Share with client", optional project of this client, optional message).
5. **Open tasks** — tasks not DONE, sorted by status then due date, with
   checkbox; link "All tasks" → `/tasks?clientId=…`.

Side column:
1. **Details** — Owner, Email (mailto), Phone, Website (opens new tab, shown
   without http://), Industry, Address (multi-line), Client since. Internal
   notes block if set. **Delete client** button with confirm: "Delete {name}?
   This also removes their contacts, projects, tasks and invoices. This cannot
   be undone."
2. **Portal access** — see 8.6.
3. **Notes** — add form ("What came out of the last conversation?"), list
   newest first: body, "{author or Unknown} · {relative time}", Delete (confirm).
4. **Timeline** — last **12** activity entries for this client.

### 8.6 Portal access card (on client detail)

- Subtitle: "No portal login yet" or "{n} login(s)". A client can have
  **several** portal logins.
- **Invite to portal**: name and email pre-filled from the **primary contact**
  (email falls back to the client's email). Password field pre-filled with a
  **generated password** (16 characters, letters and digits without look-alike
  characters such as 0/O, 1/l/I). **Generate** button makes a new one.
  - Email already used by anyone → "That email already has an account."
- No logins: "Invite this client to sign in at /login and see their projects,
  invoices and files."
- Each login: name, email, "Last signed in {date time}" or "Has not signed in
  yet", **Reset password** (inline, generated password, signs them out
  everywhere), **Revoke** (confirm: "Revoke portal access for {email}? They will
  no longer be able to sign in." → deletes the login only).

### 8.7 Contacts (`/contacts`)

- Search: first name, last name, email, title, client name. Filter: Client.
- Sorted by last name, then first name. **20 per page**.
- Columns: Name (+ Primary pill + title), Client (link), Email (mailto), Phone,
  Actions (Edit, Delete).
- No "New contact" here: header button "Add via a client" → contacts are only
  created from a client page.
- Edit contact page: same fields plus **Client** selector (a contact can be
  moved to another client). Save → back to the client page.

### 8.8 Projects list (`/projects`)

- Search: name, description, client name. Filters: Status, Client.
- Newest first, **15 per page**.
- Columns: Project (+ description), Client, Status, Budget, Tasks count,
  Timeline ("start → end", "—" / "open" when missing).

### 8.9 New / edit project

- If no clients exist: "Add a client first" + New client.
- Client pre-selected from `?clientId=` if valid, else the first client
  alphabetically.
- Fields: client*, name*, status (default PLANNING), budget (default 0.00),
  project link (URL, hint "Shown to the client in their portal as 'Visit
  project'"), start date, end date, description.
- End date before start date → "End date cannot be before the start date".

### 8.10 Project detail (`/projects/{id}`)

- Header: name, description, breadcrumb "Projects / {client}", **Visit project**
  (if link set, new tab), **New invoice** (pre-selects client + project), **Edit**.
- **Tasks** card: "{done} of {total} complete", progress bar + "{n}% complete",
  task rows with checkbox, "Manage tasks" → `/tasks?projectId=…`. Empty: "Break
  the project down so the next step is always visible."
- **Invoices** card: number, due date, total, status.
- Side **Details**: Client, Status, Budget, Invoiced, Project link ("Not set"),
  Start, End, **Budget used** bar (if budget > 0).
- **Delete project** (confirm "Delete {name}? Its tasks will be removed too.").

### 8.11 Tasks (`/tasks`)

- Header subtitle: "{n} open · {n} overdue" or "{n} open · nothing overdue".
- **New task** opens an inline panel. Defaults: client and project from the URL
  filters, assignee = URL assignee filter **or the current user**.
- Search: title, description. Filters: Status, Priority, Client, Assignee.
  (`projectId` filter works from links but has no dropdown.)
- **No pagination**: all matching tasks shown.
- Two sections: **Open** and **Completed**. Sorted by status, due date, newest.
- Each row: checkbox (complete/reopen), title (struck through when done),
  description, client, project, priority badge, "Overdue · {date}" (red) or
  "Due {date}", assignee or "Unassigned", Edit, Delete (confirm).
- Task form: title*, status, priority, due date, client ("No client"), project
  ("No project"; list narrows to the chosen client; hint "Picking a project sets
  the client automatically."), assignee ("Unassigned", staff only), description.
- **Link rule:** if a project is chosen, the task's client is forced to that
  project's client. If no project, the chosen client (or none) is used.
- Create stays on the page; edit redirects to `/tasks`.

### 8.12 Invoices list (`/invoices`)

- Header subtitle: "{outstanding} outstanding · {collected} collected" (for the
  current filter).
- Search: invoice number, client name. Filters: Status (all 5, matched on
  **effective** status), Client.
- Newest issue date first. **No pagination**. Footer: "{n} invoices".
- Columns: Invoice (+ project), Client, Status, Issued, Due, Total.

### 8.13 New / edit invoice

- If no clients: "Add a client first".
- New defaults: client from `?clientId=` or first client; project from
  `?projectId=` only if it belongs to that client; **number = next number**;
  status DRAFT; issue date today; due date today + 30 ("Net-30 by default");
  tax 0; one empty line.
- **Next number:** take the highest invoice number (text sort), read the digits
  at the end, add 1, format `INV-{n}`. No invoices yet → `INV-1001`.
- Fields: client*, project (only that client's projects), number*, status, issue
  date, due date, tax rate % (0–100), notes, line items.
- **Line items editor:** description, qty, unit price, live line amount,
  Remove (removing the last row resets it to empty instead). **Add line**.
  Rows with an empty description are ignored. At least one line required.
- Live Subtotal / Tax ({rate}%) / Total.
- Server rules: number must be unique ("That invoice number is already in
  use."); due date not before issue date; project must belong to the client
  (otherwise silently dropped).
- Edit replaces all lines with the submitted ones. Missing dates on edit keep
  the previous dates.

### 8.14 Invoice detail (`/invoices/{id}`)

- Header: number, "Issued X · due Y", breadcrumb "Invoices / {client}", status
  buttons (see 3.4), Edit.
- Invoice body: **Bill to** (company or name, address lines, email), **Amount
  due** (shows $0.00 when paid, plus "Paid {date}"), lines table (Description,
  Qty, Unit price, Amount), Subtotal, Tax ({rate}%), Total, Notes.
- Side panel: Status badge, Client, Project, Issued, Due, Void / Reopen as
  draft, Delete (confirm "Delete invoice {n}? This cannot be undone.").

### 8.15 Files (`/files`)

- Header: "{n} files · {n} received from clients · {size} stored".
- Search: filename, message, client name. Filters: Direction (Both ways /
  Received from clients / Shared by your team), Client.
- **Latest 100 files** only, newest first, **grouped by client** (one card per
  client with "{n} files").
- Upload card "Share a file with a client": client picker (required), project
  picker narrows to that client's projects, file, message. If no clients: "Add a
  client first…".

### 8.16 Reports (`/reports`)

See 7.6. Cards: 4 totals, Top clients table (Client, Status, Billed, Collected,
Outstanding), Pipeline by project status (budget + count for all 5 statuses,
including zeros), Delivery bar, Revenue by industry.

### 8.17 Search (`/search`)

- Empty query: "Start typing".
- Up to **8 results per type**:
  - Clients: name, company, email, industry → client page
  - Contacts: first/last name, email, title → their client's page
  - Projects: name, description, client name → project page
  - Tasks: title, description, client name → task **edit** page
  - Invoices: number, notes, client name → invoice page (shows total)
- No results: empty state.

### 8.18 Team (`/team`) — admin rank only

- Description: "You can only change accounts ranked below your own. Client
  portal logins are managed on each client's page."
- Card title: "{n} teammates". **Add teammate** shown only if you can assign at
  least one role.
- Add form: name, email, role (only roles below you; hint "Admins can add and
  remove members. Members have full access to client data but cannot change
  accounts."), temporary password (pre-generated; hint "Send this over a channel
  you trust. Setting a password signs the account out of every device.").
- List: super admin row **hidden for admins**. Sorted by rank (highest first),
  then name. "You" tag on your own row.
- Columns: Name + email, Role, Last sign-in ("Never"), Added, Actions.
- Role column: a dropdown that saves immediately on change (if you can manage
  them), else a badge plus reason text:
  - "Workspace owner" (super admin)
  - "Only administrator"
  - "Your own account"
  - "Outranks you"
- Actions: Reset password (if you outrank them), Remove (if manageable and not
  the last admin; confirm "Remove {name}? They will be signed out and lose
  access immediately. Their notes and activity history are kept.").

### 8.19 Oversight (`/oversight`) — super admin only

- Description: "What your admins and their teams have been doing, {period}.
  Read-only — this page changes nothing."
- Period: Last 7 / **30 (default)** / 90 days / All time (from URL).
- **4 summary tiles** (for the period, all people):
  Actions logged · Staff active "{n} of {total}" · Account & access changes ·
  Deletions (red if > 0).
- **The team** table: every staff account, sorted by rank then action count:
  Name (link filters the feed to them), Role, Actions, Last action (relative or
  "Nothing yet"), Last sign-in ("Never"). Counts ignore the category/person
  filter.
- **Activity** feed: filters Person, Category. **30 per page**. Each entry:
  message, "{actor or 'A removed account'} · {client link} · {relative time}",
  category pill (hover shows the exact type).

---

## 9. Client portal: screen by screen

Every portal query is filtered by the signed-in client's id. Drafts are never
shown.

### 9.1 Portal layout

- Header: logo, **client name**, user name, Sign out. Tabs below.
- Footer: "Questions? Your account manager is {owner name} ({owner email})." or,
  with no owner, "Questions? Reply to your latest email from us and we'll pick
  it up."

### 9.2 Overview (`/portal`)

- Title "Hello, {first name}". Button **Send us a file** → `/portal/files`.
- Tiles: Active projects · Balance due (+ past-due line) · Paid to date.
- **Project progress**: projects with status **ACTIVE or PLANNING**: name,
  "{done} of {n} steps complete" or "Not broken down yet", "· target {end
  date}", Visit project, progress bar "{n}% complete". Empty: "Once work starts,
  its progress will show up here."
- **Invoices due**: up to **4** SENT/OVERDUE invoices: number, due, total, badge.
- **Recent files**: last **5** files.

### 9.3 Projects (`/portal/projects`)

All of the client's projects (any status), sorted by status then newest: name,
description, "Started {date}" or "Not started", "· target {date}", status,
Visit project, progress bar with "{n}% complete · {done} of {n} steps · {n} in
progress" or "No steps published yet".

### 9.4 Project detail (`/portal/projects/{id}`)

- Overall progress % and bar.
- **What's next**: tasks not DONE (sky dot = in progress, grey = to do), with
  "Target {due date}". Empty: "Every published step is done. We'll add more as
  the work moves on."
- **Completed**: DONE tasks.
- **Files** for this project.
- Details: Status, Started, Target finish, Open project link.
- **Invoices** for this project (non-draft).

Every task on the project is shown to the client as a "step", including its
title. There is no "internal task" flag.

### 9.5 Invoices (`/portal/invoices`)

- Subtitle "{amount} outstanding" or "Everything is settled".
- Table: Invoice, Project, Status, Issued, Due, Amount. Footer count and
  Outstanding total.
- Detail page: status badge, Billed to, Project link, "Amount due" or "Amount
  paid" + "Received {date}", lines, totals, notes, and the text "Need a change
  to this invoice, or a copy for your finance team? Reply to your account
  manager and we'll sort it out." There is **no online payment**.

### 9.6 Files (`/portal/files`)

- **Shared with you**: files uploaded by staff (no delete button).
- **Files you sent**: "{n} files · you can remove your own uploads" (Delete).
- Upload panel: file, optional project (their projects), message. Button
  **Send file**. The client id always comes from the session.

### 9.7 Account (`/portal/account`)

- Details: Name, Email, Account (client name), Last sign-in ("This is your first
  visit").
- "Need your name or email changed? Ask {owner} ({email})." — clients cannot
  edit their own name or email.
- **Change password** form (see 5.6).

---

## 10. Forms and validation rules

General behaviour:
- All text is trimmed. Empty optional fields are saved as empty (null).
- Errors are shown under each field; general errors at the top of the form.
- Submit buttons show "Saving…" / "Uploading…" / "Working…" while pending.
- Inline "add" panels (contact, task, teammate, portal user) close and reset
  after success.

| Form | Rules |
| --- | --- |
| Login | email required + valid; password required |
| Register | name 1–120; valid email; password ≥ 8; confirm must match |
| Client | name 1–160 required; email valid if given; status one of 4 |
| Contact | client required; first/last name 1–80; email valid if given |
| Project | client required; name 1–160; status one of 5; budget ≥ 0 (non-numeric characters stripped, "$1,250.50" works); link must start with http:// or https://; valid dates; end ≥ start |
| Task | title 1–200; status and priority from lists; valid date |
| Invoice | client required; number 1–40, unique; tax 0–100; ≥ 1 line; each line description 1–200, qty > 0 (empty = 1), unit price ≥ 0; due ≥ issue |
| Note | 1–5000 chars |
| File message | max 500 (longer is cut, not rejected) |
| Portal invite | name 1–120; valid email, unused; password ≥ 8 |
| Team member | name 1–120; valid email, unused; password ≥ 8; role you're allowed to give |
| Password reset (staff or portal) | password ≥ 8 |
| Change password | current required; new ≥ 8; confirm matches; new ≠ current |

---

## 11. Files

### 11.1 Upload rules

- Max **25 MB** per file. The form warns immediately if the chosen file is too
  big, and shows "{name} · {size}" after picking.
- Allowed extensions: pdf, png, jpg, jpeg, gif, webp, svg, txt, csv, md, json,
  zip, doc, docx, xls, xlsx, ppt, pptx. Type must also be on the allowed list
  (or blank/generic).
- Rejected: "That file type is not accepted. Allowed: documents, spreadsheets,
  presentations, PDFs, images, text, CSV, JSON and ZIP."
- Empty file: "Choose a file to upload."
- Filename cleaned: folder path removed, unsafe characters become `_`, max 180
  characters, "file" if nothing left.
- Optional project must belong to the same client, otherwise ignored.

### 11.2 Download (`/api/files/{id}`)

- Staff: any file. Client: only their own client's files. Anything else → 404.
- File missing on disk → 410 "This file is no longer available on the server."
- PDF, PNG, JPEG, GIF, WebP open **in the browser** when clicked; everything
  else (including SVG) downloads.

### 11.3 Delete

- Staff can delete any file. A client can delete only files they uploaded.
- Confirm: "Delete {filename}? This removes the file for everyone."
- Removes the record and the file on disk. Not logged in activity.

### 11.4 File row display

Filename (download link), message, origin pill, size, relative time, project,
Download, Delete (if allowed).

| Viewer | Staff upload | Client upload |
| --- | --- | --- |
| Staff | "Shared by {name or 'your team'}" | "Sent by {name or 'the client'}" (blue pill) |
| Client | "Shared with you" | "Sent by {name or 'you'}" (blue pill) |

---

## 12. Activity log

Written automatically by the server. Never editable. If writing a log entry
fails, the user's action still succeeds.

### 12.1 Logged events

| Type | When | Category |
| --- | --- | --- |
| CLIENT_CREATED | client created | Client work |
| CLIENT_UPDATED | client edited, status unchanged | Client work * |
| CLIENT_STATUS_CHANGED | client edited with new status | Client work * |
| CLIENT_DELETED | client deleted | Deletions |
| CONTACT_ADDED | contact created | Client work |
| NOTE_ADDED | note added | Client work |
| PROJECT_CREATED | project created | Client work |
| PROJECT_STATUS_CHANGED | project edited with new status | Client work |
| PROJECT_DELETED | project deleted | Deletions |
| TASK_CREATED | task created | Client work |
| TASK_COMPLETED | checkbox ticked to done | Client work |
| INVOICE_CREATED | invoice created | Client work |
| INVOICE_STATUS_CHANGED | quick button, or edit with new status | Client work |
| INVOICE_DELETED | invoice deleted | Deletions |
| FILE_SHARED | staff upload | Files |
| FILE_RECEIVED | portal upload | Files |
| PORTAL_ACCESS_GRANTED | portal login created | Accounts & access |
| PORTAL_ACCESS_REVOKED | portal login revoked | Accounts & access |
| PORTAL_PASSWORD_RESET | staff reset a portal password | Accounts & access |
| PORTAL_PASSWORD_CHANGED | client changed own password | Client work * |
| STAFF_PASSWORD_CHANGED | staff changed own password | Client work * |
| TEAM_MEMBER_ADDED | teammate added | Accounts & access |
| TEAM_MEMBER_REMOVED | teammate removed | Accounts & access |
| TEAM_ROLE_CHANGED | role changed | Accounts & access |
| TEAM_PASSWORD_RESET | teammate password reset | Accounts & access |

\* Not listed in any category, so it falls into "Client work" by default.

### 12.2 Not logged

Contact edit/delete, note delete, task edit (other than create/complete), task
reopen, task delete, file delete, sign-in, sign-out.

### 12.3 Where it is shown

- Dashboard: last 10, everyone.
- Client page timeline: last 12 for that client.
- Oversight: full feed with filters (super admin).

---

## 13. Search, filters and pagination

- Every search is **case-insensitive** and matches anywhere in the text.
- Search boxes update the URL **300 ms** after typing stops; filters update
  immediately. Changing either resets to page 1. Filters live in the URL, so
  views are shareable and the back button works.
- Pagination: "Page X of Y · N results" with Previous / Next. With one page:
  "N results".

| Page | Page size |
| --- | --- |
| Clients | 12 |
| Projects | 15 |
| Contacts | 20 |
| Oversight feed | 30 |
| Tasks, Invoices | no paging (all) |
| Files | latest 100 |
| Search | 8 per type |

Pickers for owner and assignee only list **staff** (never portal users).
Client pickers are alphabetical.

---

## 14. Formatting rules

| Thing | Format |
| --- | --- |
| Money | US dollars, `$1,250.50`. Compact on dashboard: `$1.2M`, `$84.5K` |
| Dates | `Oct 28, 2026` (UTC); missing → `—` |
| Date + time | `Oct 28, 2026, 3:45 PM` |
| Relative time | "just now", "5 minutes ago", "in 2 weeks", "3 months ago" |
| File size | `812 B`, `4.2 KB`, `25 MB` |
| Initials | first + last word initials, or first 2 letters of a single word |
| Enum labels | `IN_PROGRESS` → "In Progress" |
| Plurals | "1 step" / "3 steps" |

**Status badge colours:**

| Colour | Values |
| --- | --- |
| Amber | LEAD, MEDIUM |
| Emerald (green) | ACTIVE, DONE, PAID |
| Slate (grey) | INACTIVE, ARCHIVED, TODO, DRAFT, VOID, LOW, ADMIN |
| Sky (blue) | PLANNING, IN_PROGRESS, SENT, MEMBER |
| Orange | ON_HOLD |
| Indigo | COMPLETED |
| Rose (red) | CANCELLED, OVERDUE, HIGH |
| Violet | SUPER_ADMIN |

Activity category pills: Accounts & access = violet, Deletions = rose, Files =
sky, Client work = slate. The UI supports light and dark mode.

---

## 15. System behaviour

- **Start-up checks** (app refuses to start, listing every problem):
  DATABASE_URL missing; DATABASE_URL_UNPOOLED missing or pointing at a pooler;
  AUTH_SECRET missing, under 32 characters, or a placeholder;
  ALLOW_OPEN_REGISTRATION on in production; SQLite URL in production; Neon URL
  without `sslmode` in production; `pgbouncer=true` on a Neon URL.
- **Health check** `/api/health`: `{"status":"ok","database":"ok","latencyMs":n}`
  or 503 `{"status":"error","database":"unreachable"}`. No sign-in needed.
- **Search engines:** everything blocked (`robots.txt` disallows all).
- **Security headers:** strict Content-Security-Policy, no framing, no MIME
  sniffing, strict referrer, camera/mic/location off, HSTS in production.

---

## 16. Command-line scripts

| Command | What it does |
| --- | --- |
| `npm run superadmin` | Creates the super admin from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` (default name "Super Admin"), or promotes that existing account. Only resets the password if `SUPERADMIN_RESET_PASSWORD=true` (which also signs them out everywhere). Never deletes anything. |
| `npm run db:seed` | **Deletes all data** (keeps super admins) and loads demo data: admin, 2 members, demo clients, and a portal login for Northwind Logistics. |
| `npm run db:migrate` | Applies database migrations. |

---

## 17. Gaps and quirks worth designing around

These are how the app behaves today. Each one is a design decision to make.

1. **Any staff member can delete a client** and all its data, with one confirm.
2. **Each staff member sees only their own clients** (the super admin included). Ownership is fixed at creation.
3. **No staff "change my password" or profile page.** Only clients have an
   account page.
4. **No forgot-password and no email.** Passwords are copied and sent by hand.
5. **No online payment.** "Mark paid" is manual.
6. **Every project task is visible to the client** as a step. There is no way
   to keep a task internal except leaving it off the project.
7. **Unticking a done task sets it to TODO**, even if it was In Progress before.
8. **Portal "Active projects" tile counts ACTIVE only**, but the progress list
   below shows ACTIVE and PLANNING.
9. **Average invoice (Reports) includes drafts and voids**, while every other
   money figure excludes them.
10. **OVERDUE can be picked manually** in the invoice form, even with a future
    due date.
11. **Invoice numbers sort as text** when finding the next one, so `INV-999`
    sorts after `INV-1000` and could produce a duplicate suggestion (the save
    then fails with "already in use").
12. **Deleting a client leaves its files on disk.**
13. **Tasks and Invoices lists have no pagination**, so they can grow long.
14. **Files page shows only the latest 100.**
15. **Oversight feed also includes portal client actions** (e.g. file uploads,
    password changes), not only staff.
16. **Several edits are not logged** (see 12.2), so Oversight won't show them.
17. **An admin can't change anyone's role in practice**: they can only assign
    MEMBER, and they can only act on members.
18. **Contacts can be moved to another client** from the contact edit page.
19. **The "Outstanding" dashboard tile links to SENT invoices only**, not
    overdue ones.
