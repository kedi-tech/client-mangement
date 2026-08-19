import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { homePathFor, isPortalRole, isSessionRevoked } from "../src/lib/auth-token";
import {
  USER_ROLES,
  assignableRolesFor,
  canManageRole,
  isAdminRole,
  roleRank,
} from "../src/lib/constants";
import { checkEnv, parseBoolean } from "../src/lib/env";
import { describeRetryAfter } from "../src/lib/format";

/** A configuration that passes every check, to vary one field at a time. */
function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pw@db:5432/client_management",
    DATABASE_URL_UNPOOLED: "postgresql://user:pw@db:5432/client_management",
    AUTH_SECRET: "3PjK2mQx8vB4nR7tZ1yL6wF0sD9gH5cA2eU4iO8pN3k=",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

const problemFor = (env: NodeJS.ProcessEnv, variable: string) =>
  checkEnv(env).find((problem) => problem.variable === variable);

describe("environment validation", () => {
  it("accepts a complete production configuration", () => {
    assert.deepEqual(checkEnv(validEnv()), []);
  });

  it("requires a database URL", () => {
    assert.ok(problemFor(validEnv({ DATABASE_URL: undefined }), "DATABASE_URL"));
    assert.ok(problemFor(validEnv({ DATABASE_URL: "   " }), "DATABASE_URL"));
  });

  it("rejects a SQLite URL in production, since the schema targets Postgres", () => {
    const problem = problemFor(validEnv({ DATABASE_URL: "file:./dev.db" }), "DATABASE_URL");
    assert.match(problem?.message ?? "", /postgresql/i);
  });

  it("requires a direct URL for migrations", () => {
    // Prisma Migrate connects through DATABASE_URL_UNPOOLED; without it the
    // schema simply cannot be applied.
    assert.ok(problemFor(validEnv({ DATABASE_URL_UNPOOLED: undefined }), "DATABASE_URL_UNPOOLED"));
  });

  it("rejects a pooled endpoint for migrations", () => {
    // The bug this catches is silent: migrations hang on a transaction-mode
    // pooler rather than failing cleanly, and only on deploy.
    const neonPooled =
      "postgresql://u:p@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/db?sslmode=require";
    const problem = problemFor(
      validEnv({ DATABASE_URL_UNPOOLED: neonPooled }),
      "DATABASE_URL_UNPOOLED",
    );
    assert.match(problem?.message ?? "", /pooler|pooled/i);

    // Also caught when the pooler is signalled by a parameter rather than a host.
    assert.ok(
      problemFor(
        validEnv({ DATABASE_URL_UNPOOLED: "postgresql://u:p@host/db?pgbouncer=true" }),
        "DATABASE_URL_UNPOOLED",
      ),
    );
  });

  it("accepts a Neon pair: pooled for queries, direct for migrations", () => {
    assert.deepEqual(
      checkEnv(
        validEnv({
          DATABASE_URL:
            "postgresql://u:p@ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech/db?sslmode=require",
          DATABASE_URL_UNPOOLED:
            "postgresql://u:p@ep-cool-name-123456.eu-central-1.aws.neon.tech/db?sslmode=require",
        }),
      ),
      [],
    );
  });

  it("insists on TLS for Neon in production", () => {
    const problem = problemFor(
      validEnv({
        DATABASE_URL: "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db",
        DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db",
      }),
      "DATABASE_URL",
    );
    assert.match(problem?.message ?? "", /sslmode/i);
  });

  it("requires a long, non-placeholder auth secret", () => {
    assert.ok(problemFor(validEnv({ AUTH_SECRET: undefined }), "AUTH_SECRET"));
    assert.ok(problemFor(validEnv({ AUTH_SECRET: "too-short" }), "AUTH_SECRET"));

    const placeholder = problemFor(
      validEnv({ AUTH_SECRET: "change-me-to-a-long-random-string-at-least-32-chars" }),
      "AUTH_SECRET",
    );
    assert.match(placeholder?.message ?? "", /placeholder/i);
  });

  it("refuses to start production with self-registration left open", () => {
    assert.ok(problemFor(validEnv({ ALLOW_OPEN_REGISTRATION: "true" }), "ALLOW_OPEN_REGISTRATION"));
    // The same setting is fine outside production.
    assert.deepEqual(
      checkEnv(validEnv({ NODE_ENV: "development", ALLOW_OPEN_REGISTRATION: "true" })),
      [],
    );
  });

  it("reports every problem at once rather than one per restart", () => {
    const problems = checkEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    const names = problems.map((problem) => problem.variable);
    assert.ok(names.includes("DATABASE_URL"));
    assert.ok(names.includes("AUTH_SECRET"));
  });

  it("reads booleans the way an operator would write them", () => {
    for (const truthy of ["1", "true", "TRUE", "yes", "on"]) {
      assert.equal(parseBoolean(truthy), true, truthy);
    }
    for (const falsy of ["0", "false", "no", "", undefined]) {
      assert.equal(parseBoolean(falsy), false, String(falsy));
    }
  });
});

describe("session revocation", () => {
  const revokedAt = new Date("2026-01-01T12:00:00.000Z");
  const at = (iso: string) => new Date(iso).getTime();

  it("rejects a token issued before the revocation", () => {
    assert.equal(isSessionRevoked(at("2026-01-01T11:59:00.000Z"), revokedAt), true);
  });

  it("accepts a token issued after the revocation", () => {
    assert.equal(isSessionRevoked(at("2026-01-01T12:00:05.000Z"), revokedAt), false);
  });

  it("tolerates the one-second flooring of the JWT iat claim", () => {
    // A sign-in at 12:00:00.400 writes sessionsValidFrom with milliseconds but
    // mints a token whose `iat` floors to 12:00:00.000. Without the leeway the
    // user would be signed out by their own password change.
    const signedInAt = new Date("2026-01-01T12:00:00.400Z");
    assert.equal(isSessionRevoked(at("2026-01-01T12:00:00.000Z"), signedInAt), false);
  });

  it("does not extend the leeway beyond a second", () => {
    assert.equal(isSessionRevoked(at("2026-01-01T11:59:58.000Z"), revokedAt), true);
  });
});

describe("throttle messages", () => {
  it("uses seconds for short waits and whole minutes for long ones", () => {
    assert.equal(describeRetryAfter(1), "1 second");
    assert.equal(describeRetryAfter(45), "45 seconds");
    assert.equal(describeRetryAfter(120), "2 minutes");
    assert.equal(describeRetryAfter(61), "61 seconds");
  });

  it("always rounds up, so the message never tells a user to retry too early", () => {
    assert.equal(describeRetryAfter(91), "2 minutes");
    assert.equal(describeRetryAfter(890), "15 minutes");
  });
});

describe("role hierarchy", () => {
  it("ranks the tiers in order", () => {
    assert.ok(roleRank("SUPER_ADMIN") > roleRank("ADMIN"));
    assert.ok(roleRank("ADMIN") > roleRank("MEMBER"));
    assert.ok(roleRank("MEMBER") > roleRank("CLIENT"));
  });

  it("treats an unknown role as the least privileged", () => {
    assert.equal(roleRank("NONSENSE"), 0);
    assert.equal(isAdminRole("NONSENSE"), false);
    assert.equal(canManageRole("NONSENSE", "MEMBER"), false);
  });

  it("lets super admins and admins reach account administration, but not members", () => {
    assert.equal(isAdminRole("SUPER_ADMIN"), true);
    assert.equal(isAdminRole("ADMIN"), true);
    assert.equal(isAdminRole("MEMBER"), false);
    assert.equal(isAdminRole("CLIENT"), false);
  });

  it("lets a super admin manage admins and members", () => {
    assert.equal(canManageRole("SUPER_ADMIN", "ADMIN"), true);
    assert.equal(canManageRole("SUPER_ADMIN", "MEMBER"), true);
  });

  it("stops an admin touching another admin", () => {
    assert.equal(canManageRole("ADMIN", "ADMIN"), false);
    assert.equal(canManageRole("ADMIN", "MEMBER"), true);
  });

  it("protects the super admin from everyone, including another super admin", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MEMBER", "CLIENT"]) {
      assert.equal(canManageRole(role, "SUPER_ADMIN"), false, `${role} must not manage SUPER_ADMIN`);
    }
  });

  it("stops anyone acting on their own account", () => {
    // Equal rank is never manageable, which covers the self case for free.
    for (const role of USER_ROLES) {
      assert.equal(canManageRole(role, role), false, `${role} must not manage itself`);
    }
  });

  it("never lets a member manage anyone", () => {
    for (const role of USER_ROLES) {
      assert.equal(canManageRole("MEMBER", role), role === "CLIENT");
    }
  });

  it("only offers roles strictly below the actor", () => {
    assert.deepEqual(assignableRolesFor("SUPER_ADMIN"), ["ADMIN", "MEMBER"]);
    // An admin cannot mint a peer, so "Member" is the only option they see.
    assert.deepEqual(assignableRolesFor("ADMIN"), ["MEMBER"]);
    assert.deepEqual(assignableRolesFor("MEMBER"), []);
  });

  it("never offers SUPER_ADMIN through the UI", () => {
    for (const role of USER_ROLES) {
      assert.ok(!assignableRolesFor(role).includes("SUPER_ADMIN"), `${role} must not assign it`);
    }
  });

  it("keeps portal routing unchanged for the new role", () => {
    assert.equal(isPortalRole("SUPER_ADMIN"), false);
    assert.equal(homePathFor("SUPER_ADMIN"), "/dashboard");
  });
});

describe("Neon connection tuning", () => {
  it("flags pgbouncer=true, which costs ~5x latency on Neon", () => {
    const problem = checkEnv({
      NODE_ENV: "production",
      DATABASE_URL:
        "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require&pgbouncer=true",
      DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db?sslmode=require",
      AUTH_SECRET: "3PjK2mQx8vB4nR7tZ1yL6wF0sD9gH5cA2eU4iO8pN3k=",
    } as NodeJS.ProcessEnv).find((p) => p.variable === "DATABASE_URL");
    assert.match(problem?.message ?? "", /pgbouncer/i);
  });

  it("is happy with a correctly tuned Neon pair", () => {
    assert.deepEqual(
      checkEnv({
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/db?sslmode=require&connect_timeout=15",
        DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db?sslmode=require",
        AUTH_SECRET: "3PjK2mQx8vB4nR7tZ1yL6wF0sD9gH5cA2eU4iO8pN3k=",
      } as NodeJS.ProcessEnv),
      [],
    );
  });
});
