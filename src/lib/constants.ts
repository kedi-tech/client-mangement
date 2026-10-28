// Domain vocabulary. SQLite has no native enum type, so these string unions are
// the single source of truth shared by the schema comments, the Zod validators
// and the UI badges.

export const CLIENT_STATUSES = ["LEAD", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "MEMBER", "CLIENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Every role that works in the admin app, most privileged first. */
export const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MEMBER"] as const;

/**
 * Prisma filter for team members only. Portal logins are User rows too, so every
 * owner/assignee picker must exclude them.
 */
export const STAFF_ONLY = { role: { in: [...STAFF_ROLES] } };

/**
 * Privilege ordering. Account administration compares ranks rather than testing
 * for named roles, so adding a tier later does not mean auditing every guard.
 */
const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  MEMBER: 1,
  CLIENT: 0,
};

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0;
}

/** SUPER_ADMIN and ADMIN both reach /team; MEMBER does not. */
export function isAdminRole(role: string): boolean {
  return roleRank(role) >= ROLE_RANK.ADMIN;
}

export function isSuperAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Whether `actorRole` may change or remove an account holding `targetRole`.
 *
 * Strictly greater rank, which buys three properties at once: an admin cannot
 * touch another admin, nobody can act on a super admin (so the workspace can
 * never be locked out of account administration), and nobody can act on their
 * own account.
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  return roleRank(actorRole) > roleRank(targetRole);
}

/**
 * Roles an actor may hand out — everything strictly below their own rank. Stops
 * an admin minting a peer they would then be unable to manage.
 */
export function assignableRolesFor(actorRole: string): UserRole[] {
  return STAFF_ROLES.filter((role) => canManageRole(actorRole, role));
}

/** Human-readable label for any SCREAMING_SNAKE_CASE enum value. */
export function label(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Colour family for the status pill of each domain value. Each tone maps to the
 * `--{tone}-f` (text), `--{tone}-d` (border/dot) and `--{tone}-b` (fill) tokens
 * in globals.css, so pills follow the theme automatically.
 */
export type Tone = "amber" | "emerald" | "slate" | "sky" | "orange" | "indigo" | "rose" | "violet";

export const STATUS_TONES: Record<string, Tone> = {
  LEAD: "amber",
  MEDIUM: "amber",
  ACTIVE: "emerald",
  DONE: "emerald",
  PAID: "emerald",
  INACTIVE: "slate",
  ARCHIVED: "slate",
  TODO: "slate",
  DRAFT: "slate",
  VOID: "slate",
  LOW: "slate",
  ADMIN: "slate",
  PLANNING: "sky",
  IN_PROGRESS: "sky",
  SENT: "sky",
  MEMBER: "sky",
  ON_HOLD: "orange",
  COMPLETED: "indigo",
  CANCELLED: "rose",
  OVERDUE: "rose",
  HIGH: "rose",
  SUPER_ADMIN: "violet",
};

export function toneFor(value: string): Tone {
  return STATUS_TONES[value] ?? "slate";
}

/* -------------------------------------------------------------- oversight */

/**
 * Activity types grouped for the super admin's oversight view.
 *
 * The interesting split is not "which table changed" but "how much would this
 * hurt if it were not you who did it" — so account and access changes come
 * first, deletions next, and routine client work last.
 */
export const ACTIVITY_CATEGORIES = {
  ACCESS: {
    label: "Accounts & access",
    types: [
      "TEAM_MEMBER_ADDED",
      "TEAM_MEMBER_REMOVED",
      "TEAM_ROLE_CHANGED",
      "TEAM_PASSWORD_RESET",
      "PORTAL_ACCESS_GRANTED",
      "PORTAL_ACCESS_REVOKED",
      "PORTAL_PASSWORD_RESET",
    ],
  },
  DELETION: {
    label: "Deletions",
    types: ["CLIENT_DELETED", "PROJECT_DELETED", "INVOICE_DELETED"],
  },
  FILES: {
    label: "Files",
    types: ["FILE_SHARED", "FILE_RECEIVED"],
  },
  WORK: {
    label: "Client work",
    types: [
      "CLIENT_CREATED",
      "CONTACT_ADDED",
      "PROJECT_CREATED",
      "PROJECT_STATUS_CHANGED",
      "TASK_CREATED",
      "TASK_COMPLETED",
      "INVOICE_CREATED",
      "INVOICE_STATUS_CHANGED",
      "NOTE_ADDED",
    ],
  },
} as const;

export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;

export const ACTIVITY_CATEGORY_KEYS = Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[];

/**
 * What Oversight shows instead of the logged message for anything touching a
 * client. Staff only ever see their own clients, the super admin included, so
 * the oversight feed says *what kind* of thing happened and never to whom.
 * Types not listed (team administration) keep their original message.
 */
export const OVERSIGHT_GENERIC_MESSAGES: Record<string, string> = {
  CLIENT_CREATED: "Added a client",
  CLIENT_UPDATED: "Updated a client's details",
  CLIENT_STATUS_CHANGED: "Changed a client's status",
  CLIENT_DELETED: "Deleted a client",
  CONTACT_ADDED: "Added a contact",
  NOTE_ADDED: "Added a note",
  PROJECT_CREATED: "Started a project",
  PROJECT_STATUS_CHANGED: "Changed a project's status",
  PROJECT_DELETED: "Deleted a project",
  TASK_CREATED: "Created a task",
  TASK_COMPLETED: "Completed a task",
  INVOICE_CREATED: "Created an invoice",
  INVOICE_STATUS_CHANGED: "Changed an invoice's status",
  INVOICE_DELETED: "Deleted an invoice",
  FILE_SHARED: "Shared a file with a client",
  FILE_RECEIVED: "Received a file from a client",
  PORTAL_ACCESS_GRANTED: "Gave a client portal access",
  PORTAL_ACCESS_REVOKED: "Revoked a client's portal access",
  PORTAL_PASSWORD_RESET: "Reset a client's portal password",
};

export function oversightMessage(entry: { type: string; message: string; clientId: string | null }): string {
  return OVERSIGHT_GENERIC_MESSAGES[entry.type] ?? (entry.clientId ? "Worked on a client" : entry.message);
}

/** Which bucket an activity type falls in; unknown types read as client work. */
export function activityCategory(type: string): ActivityCategory {
  for (const key of ACTIVITY_CATEGORY_KEYS) {
    if ((ACTIVITY_CATEGORIES[key].types as readonly string[]).includes(type)) return key;
  }
  return "WORK";
}

/** Tones for the category pill and activity dots, reusing the palette above. */
export const ACTIVITY_CATEGORY_TONES: Record<ActivityCategory, Tone> = {
  ACCESS: "violet",
  DELETION: "rose",
  FILES: "sky",
  WORK: "slate",
};
