/**
 * Environment configuration and its validation.
 *
 * Kept free of Node-only imports so the Edge middleware can read it. The checks
 * run once at server start from `src/instrumentation.ts`, so a misconfigured
 * deployment fails immediately and loudly rather than at the first request that
 * happens to need a secret.
 */

/** Placeholders shipped in .env.example that must never reach production. */
const PLACEHOLDER_SECRETS = new Set([
  "change-me-to-a-long-random-string-at-least-32-chars",
  "secret",
  "changeme",
  "development",
]);

const MIN_SECRET_LENGTH = 32;

export type EnvProblem = { variable: string; message: string };

/**
 * Whether a connection string points at a transaction-mode pooler.
 *
 * Neon names its pooled host `<endpoint>-pooler.<region>...`; other providers
 * signal it with a `pgbouncer=true` parameter. Migrations must never use one.
 */
function isPooled(url: string): boolean {
  return /-pooler\./i.test(url) || /[?&]pgbouncer=true/i.test(url);
}

function isNeon(url: string): boolean {
  return /\.neon\.tech/i.test(url);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Collect every configuration problem at once, so an operator fixing a
 * deployment sees the whole list instead of one error per restart.
 */
export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const production = env.NODE_ENV === "production";

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    problems.push({
      variable: "DATABASE_URL",
      message: "is required. Point it at your Postgres server.",
    });
  } else if (production && databaseUrl.startsWith("file:")) {
    problems.push({
      variable: "DATABASE_URL",
      message:
        "is a SQLite file path, but this build targets Postgres. Use a postgresql:// connection string.",
    });
  }

  // Prisma Migrate uses this one; see the `directUrl` note in schema.prisma.
  const directUrl = env.DATABASE_URL_UNPOOLED?.trim();
  if (!directUrl) {
    problems.push({
      variable: "DATABASE_URL_UNPOOLED",
      message:
        "is required — Prisma Migrate connects through it. On Neon use the direct (non-pooler) string; on a plain Postgres with no pooler, set it to the same value as DATABASE_URL.",
    });
  } else if (isPooled(directUrl)) {
    // The failure this prevents is nasty: migrations hang holding a lock rather
    // than erroring cleanly, and it only shows up on deploy.
    problems.push({
      variable: "DATABASE_URL_UNPOOLED",
      message:
        "points at a pooled endpoint (-pooler / pgbouncer). Migrations cannot run through a transaction-mode pooler. Use the direct connection string instead.",
    });
  }

  // Measured: this flag makes Prisma disable prepared statements, costing ~5x
  // latency on Neon (1084ms vs 218ms per warm query). Neon's pooler supports
  // them, so the flag buys nothing. A warning, not a hard failure — it still works.
  if (databaseUrl && isNeon(databaseUrl) && /[?&]pgbouncer=true/i.test(databaseUrl)) {
    problems.push({
      variable: "DATABASE_URL",
      message:
        "sets pgbouncer=true. Neon's pooler supports prepared statements, and this flag makes Prisma disable them — roughly 5x slower per query. Remove it.",
    });
  }

  if (production && databaseUrl && isNeon(databaseUrl) && !databaseUrl.includes("sslmode=")) {
    problems.push({
      variable: "DATABASE_URL",
      message: "should set sslmode=require — Neon refuses connections without TLS.",
    });
  }

  const secret = env.AUTH_SECRET?.trim();
  if (!secret) {
    problems.push({
      variable: "AUTH_SECRET",
      message: "is required. Generate one with: openssl rand -base64 32",
    });
  } else {
    if (secret.length < MIN_SECRET_LENGTH) {
      problems.push({
        variable: "AUTH_SECRET",
        message: `must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}). Generate one with: openssl rand -base64 32`,
      });
    }
    if (PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
      problems.push({
        variable: "AUTH_SECRET",
        message: "is still the example placeholder. Generate a real one: openssl rand -base64 32",
      });
    }
  }

  if (production && parseBoolean(env.ALLOW_OPEN_REGISTRATION)) {
    problems.push({
      variable: "ALLOW_OPEN_REGISTRATION",
      message:
        "is enabled. Anyone who reaches /register would get a staff account with access to every client. Unset it once your first admin exists.",
    });
  }

  return problems;
}

/** Throws with every problem listed. Called once from instrumentation at boot. */
export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
  const problems = checkEnv(env);
  if (problems.length === 0) return;

  const detail = problems.map((p) => `  - ${p.variable} ${p.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${detail}\n`);
}

export function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Self-registration at /register. Off by default: the route exists only to
 * bootstrap the very first admin, after which staff are added from /team.
 * Set ALLOW_OPEN_REGISTRATION=true to keep it open (development only).
 */
export function openRegistrationEnabled(): boolean {
  return parseBoolean(process.env.ALLOW_OPEN_REGISTRATION);
}

/**
 * Public origin of the deployment, used for absolute URLs and to decide whether
 * HSTS should be sent. Optional — everything works without it.
 */
export function appUrl(): string | null {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}
