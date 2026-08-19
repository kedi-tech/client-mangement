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

/** Tailwind classes for the status pill of each domain value. */
export const STATUS_TONES: Record<string, string> = {
  // Client
  LEAD: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
  ACTIVE:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  INACTIVE:
    "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30",
  ARCHIVED:
    "bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/30",
  // Project
  PLANNING:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  ON_HOLD:
    "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/30",
  COMPLETED:
    "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/30",
  CANCELLED:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
  // Task
  TODO: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30",
  IN_PROGRESS:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  DONE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  // Invoice
  DRAFT:
    "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30",
  SENT: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  OVERDUE:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
  VOID: "bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/30",
  // Roles
  SUPER_ADMIN:
    "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/30",
  MEMBER:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  // Priority
  LOW: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30",
  MEDIUM:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
  HIGH: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
};

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

/** Which bucket an activity type falls in; unknown types read as client work. */
export function activityCategory(type: string): ActivityCategory {
  for (const key of ACTIVITY_CATEGORY_KEYS) {
    if ((ACTIVITY_CATEGORIES[key].types as readonly string[]).includes(type)) return key;
  }
  return "WORK";
}

/** Tones for the category pill, reusing the palette above. */
export const ACTIVITY_CATEGORY_TONES: Record<ActivityCategory, string> = {
  ACCESS:
    "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/30",
  DELETION:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
  FILES:
    "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/30",
  WORK: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/30",
};
