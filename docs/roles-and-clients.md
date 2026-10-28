# Roles and client management

How accounts, permissions and clients work in this app. Every rule here is
enforced on the server (in `src/server/actions/*` and `src/lib/session.ts`),
not only hidden in the UI.

---

## 1. The four roles

There are two kinds of account:

- **Staff** (your team): `SUPER_ADMIN`, `ADMIN`, `MEMBER`. They use the admin app at `/dashboard`.
- **Client** (your customers): `CLIENT`. They use the portal at `/portal`.

| Role | Rank | Lands on | What they can do |
| --- | --- | --- | --- |
| `SUPER_ADMIN` | 3 | `/dashboard` | Everything. Manages admins and members. Only role that sees `/oversight`. |
| `ADMIN` | 2 | `/dashboard` | All client work. Manages **members** only, from `/team`. |
| `MEMBER` | 1 | `/dashboard` | All client work. Cannot manage any accounts. |
| `CLIENT` | 0 | `/portal` | Sees **only their own** client's projects, invoices and files. |

### What each role can do

| Action | Super admin | Admin | Member | Client |
| --- | --- | --- | --- | --- |
| View and edit **their own** clients, projects, tasks, invoices | Yes | Yes | Yes | No |
| See another staff member's clients | No | No | No | No |
| Create and delete clients | Yes | Yes | Yes | No |
| Give a client portal access, reset or revoke it | Yes | Yes | Yes | No |
| Add, change role, reset password, remove staff | Admins and members | Members only | No | No |
| See the `/oversight` activity view | Yes | No | No | No |
| Use the portal | No | No | No | Own client only |

### The rank rule

Staff account management uses one rule: **you can only act on someone with a
strictly lower rank** (`canManageRole` in `src/lib/constants.ts`). That gives:

1. An admin cannot edit, demote or remove another admin.
2. Nobody can edit, demote or remove the super admin.
3. Nobody can act on their own account from `/team`.
4. The role dropdown only offers roles below yours, so an admin can never create another admin.

Two more safeguards:

- There is **no way to promote anyone to `SUPER_ADMIN` inside the app**. It is only set by `npm run superadmin`.
- `/team` refuses any change that would leave the workspace with **no admin**.

### Important: everyone sees only their own clients

A client belongs to the staff account that **created** it. Only that person
sees the client and everything under it: contacts, projects, tasks, invoices,
notes, files and its activity. This is true for members, admins **and the
super admin** — roles only decide who can manage accounts.

- The owner is set when the client is created and **cannot be changed** in the app.
- Tasks can only be assigned to yourself (anyone else could not see them).
- Tasks with no client are visible only to the person who created them.
- The super admin's **Oversight** page still shows what each person did, but
  client work appears as generic text ("Created an invoice"), with no client
  names or links.
- Existing data: `npm run owners:backfill` previews, and
  `npm run owners:backfill -- --apply` assigns each client to whoever created it
  (from the activity log), falling back to the super admin.

---

## 2. Creating accounts

### The super admin

Set these in `.env`, then run `npm run superadmin`:

```bash
SUPERADMIN_EMAIL="owner@example.com"
SUPERADMIN_PASSWORD="a long password you have not reused"
SUPERADMIN_NAME="Super Admin"
```

- Creates the account, or promotes an existing one with that email.
- Safe to re-run: it does **not** reset the password unless `SUPERADMIN_RESET_PASSWORD=true` is also set.
- `npm run db:seed` keeps super admin accounts when it clears the demo data.

### Staff (admins and members)

- `/register` is open **only until the first staff account exists**. That first account becomes `ADMIN`. After that, `/register` shows "Sign-up is closed".
- After that, admins add teammates from **`/team`**: create, change role, reset password, remove.
- There is no email sending. You set the password and give it to the person yourself.

### Client portal logins

Created from the client's page, never by self sign-up. See section 4.

---

## 3. Managing clients

### A client record holds

- **Basics:** name, company, email, phone, website, industry, address, internal notes.
- **Status:** `LEAD` → `ACTIVE` → `INACTIVE` → `ARCHIVED`.
- **Owner:** the staff member who created it. Fixed; decides who can see it.

### Linked to each client

| Item | Notes |
| --- | --- |
| **Contacts** | Many per client. One is the **primary** contact; setting a new one demotes the others. |
| **Projects** | Status, budget, start/end dates, progress from completed tasks, optional live project URL. |
| **Tasks** | Status, priority, due date, assignee; optionally tied to a project. |
| **Invoices** | Line items, tax, auto-numbered. Status: draft, sent, paid, void. "Overdue" is calculated from the due date. |
| **Notes** | Free-form internal notes. Clients never see these. |
| **Files** | Shared in both directions with the client. |
| **Activity** | Append-only timeline of everything that happened. |

The client page also shows totals for **billed**, **collected** and **outstanding** money.

### Finding clients

`/clients` lets you:

- Search by name, company, email, industry or city.
- Filter by status and owner.
- Sort and page through results.

Global search (`/search`) also finds clients through their contacts, projects,
tasks and invoices.

### Deleting a client

Deleting a client **permanently removes everything linked to it**: contacts,
projects, tasks, invoices, notes, file records, activity, and its portal
logins. There is no undo. Any staff member, including a `MEMBER`, can do this.

The uploaded files themselves stay on disk in `UPLOAD_DIR`. Only their database
records are removed.

If you just want a client out of the way, set the status to **`ARCHIVED`** instead.

---

## 4. Giving a client portal access

1. Open the client.
2. Find the **Portal access** card and click **Invite to portal**.
3. Name and email are pre-filled from the primary contact.
4. Click **Generate** for a strong temporary password.
5. Send the email and password to the client over a channel you trust.

From the same card you can:

- **Reset the password.** This signs the client out everywhere.
- **Revoke access.** This deletes only the login; all client data stays.
- See whether they have **ever signed in**.

A client can change their own password at `/portal/account`. If they
**forget** it, staff must reset it, because there is no "forgot password" email.

### What the client sees in `/portal`

| Page | Shows |
| --- | --- |
| **Overview** | Active projects with progress, balance due, past-due amount, paid to date, recent files. |
| **Projects** | Progress, target dates, next and completed steps, a **Visit project** button. |
| **Invoices** | Every invoice you have **sent**. Drafts stay hidden until you mark them sent. |
| **Files** | Files you shared, and an upload form to send files to you. They can delete their own uploads, not yours. |
| **Account** | Their sign-in details and a password change form. |

### How a client is kept to their own data

- Each `CLIENT` login is tied to exactly **one** client (`User.clientId`).
- Middleware keeps clients inside `/portal` and staff out of it.
- Every portal page and action checks the session again through `requirePortalUser()`, which refuses any login with no `clientId`.
- File downloads go through `/api/files/[id]`, which checks permission for each file. Files are never served as public static files.

---

## 5. Oversight (super admin only)

`/oversight` is a **read-only** view of what the team has been doing, built from
the activity log:

- **Summary:** number of actions, active staff, account and access changes, deletions.
- **The team:** each staff member's role, action count, last action, last sign-in.
- **Activity feed:** filter by period, person and category.

Categories, most sensitive first: **Accounts & access**, **Deletions**,
**Files**, **Client work**.

Admins cannot see this page, because it includes their own actions.

---

## 6. Demo accounts (after `npm run db:seed`)

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `password123` | Admin |
| `dana@example.com` | `password123` | Member |
| `priya@example.com` | `password123` | Member |
| `client@example.com` | `password123` | Client (Northwind Logistics) |

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_PORTAL_EMAIL` in `.env`
override the admin and client logins above.

> The seed **clears every table** (except super admins) first. Never run it on a database with real data.
