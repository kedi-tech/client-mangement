/**
 * Creates or repairs the workspace super admin, from the environment.
 *
 *   SUPERADMIN_EMAIL     required
 *   SUPERADMIN_PASSWORD  required on first run; on later runs it is only applied
 *                        when SUPERADMIN_RESET_PASSWORD=true
 *
 * Idempotent, and safe to run against a live database — it touches exactly one
 * account and never deletes anything. Credentials are read from the environment
 * rather than baked in, so no password ever lands in version control.
 *
 * Run with:  npm run superadmin
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\n${name} is not set. Add it to .env, then re-run:\n`);
    console.error(`  SUPERADMIN_EMAIL="you@example.com"`);
    console.error(`  SUPERADMIN_PASSWORD="a long password you have not reused"\n`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const email = required("SUPERADMIN_EMAIL").toLowerCase();
  const name = process.env.SUPERADMIN_NAME?.trim() || "Super Admin";
  const resetPassword = ["1", "true", "yes"].includes(
    (process.env.SUPERADMIN_RESET_PASSWORD ?? "").trim().toLowerCase(),
  );

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const password = required("SUPERADMIN_PASSWORD");
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`SUPERADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      process.exit(1);
    }

    const created = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Created super admin ${created.email}.`);
    return;
  }

  // The account exists. Promote it if needed, and only touch the password when
  // explicitly asked — a re-run should not silently reset a live credential.
  const updates: { role?: string; passwordHash?: string; sessionsValidFrom?: Date } = {};

  if (existing.role !== "SUPER_ADMIN") {
    updates.role = "SUPER_ADMIN";
    console.log(`Promoting ${email} from ${existing.role} to SUPER_ADMIN.`);
  }

  if (resetPassword) {
    const password = required("SUPERADMIN_PASSWORD");
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`SUPERADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      process.exit(1);
    }
    updates.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // A password change signs the account out everywhere.
    updates.sessionsValidFrom = new Date();
    console.log(`Resetting the password for ${email}.`);
  }

  if (Object.keys(updates).length === 0) {
    console.log(`${email} is already the super admin. Nothing to do.`);
    console.log(`(Set SUPERADMIN_RESET_PASSWORD=true to also reset the password.)`);
    return;
  }

  await prisma.user.update({ where: { id: existing.id }, data: updates });
  console.log(`Updated ${email}.`);
}

main()
  .catch((error) => {
    console.error("Failed to ensure the super admin:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
