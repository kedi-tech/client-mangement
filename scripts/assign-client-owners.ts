/**
 * One-off backfill for per-owner client visibility.
 *
 * Every staff account now sees only the clients it owns, so each client needs
 * the right owner and each task a creator:
 *
 *   - Client owner  = whoever created it, read from its CLIENT_CREATED activity.
 *                     No such record (or the creator was removed) → super admin.
 *   - Task creator  = the client's owner for client tasks; for tasks with no
 *                     client, whoever logged TASK_CREATED, else the assignee,
 *                     else the super admin.
 *
 * Dry run by default — it prints what would change and writes nothing.
 *
 *   npm run owners:backfill            # preview
 *   npm run owners:backfill -- --apply # write the changes
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MEMBER"];

async function main() {
  const apply = process.argv.includes("--apply");

  const staff = await prisma.user.findMany({
    where: { role: { in: STAFF_ROLES } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  const staffById = new Map(staff.map((user) => [user.id, user]));
  const superAdmin = staff.find((user) => user.role === "SUPER_ADMIN");
  if (!superAdmin) {
    console.error("No SUPER_ADMIN account exists. Run `npm run superadmin` first.");
    process.exit(1);
  }

  // Who created each client, according to the activity log.
  const created = await prisma.activity.findMany({
    where: { type: "CLIENT_CREATED", clientId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { clientId: true, actorId: true },
  });
  const creatorOf = new Map<string, string>();
  for (const entry of created) {
    if (entry.clientId && entry.actorId && staffById.has(entry.actorId) && !creatorOf.has(entry.clientId)) {
      creatorOf.set(entry.clientId, entry.actorId);
    }
  }

  const clients = await prisma.client.findMany({ select: { id: true, name: true, ownerId: true } });
  const ownerOf = new Map<string, string>();
  const clientChanges: { id: string; name: string; from: string | null; to: string }[] = [];
  for (const client of clients) {
    const owner = creatorOf.get(client.id) ?? superAdmin.id;
    ownerOf.set(client.id, owner);
    if (client.ownerId !== owner) clientChanges.push({ id: client.id, name: client.name, from: client.ownerId, to: owner });
  }

  // Who created each client-less task, according to the activity log.
  const taskLog = await prisma.activity.findMany({
    where: { type: "TASK_CREATED", entityType: "Task" },
    select: { entityId: true, actorId: true },
  });
  const taskCreator = new Map<string, string>();
  for (const entry of taskLog) {
    if (entry.entityId && entry.actorId && staffById.has(entry.actorId)) taskCreator.set(entry.entityId, entry.actorId);
  }

  const tasks = await prisma.task.findMany({
    select: { id: true, clientId: true, assigneeId: true, createdById: true },
  });
  const taskChanges: { id: string; to: string }[] = [];
  for (const task of tasks) {
    const creator = task.clientId
      ? ownerOf.get(task.clientId)!
      : (taskCreator.get(task.id) ??
        (task.assigneeId && staffById.has(task.assigneeId) ? task.assigneeId : superAdmin.id));
    if (task.createdById !== creator) taskChanges.push({ id: task.id, to: creator });
  }

  const nameOf = (id: string | null) => (id ? (staffById.get(id)?.name ?? "removed account") : "nobody");

  console.log(`\nClients: ${clients.length} total, ${clientChanges.length} change owner`);
  for (const change of clientChanges) {
    console.log(`  ${change.name}: ${nameOf(change.from)} → ${nameOf(change.to)}`);
  }
  console.log(`\nTasks: ${tasks.length} total, ${taskChanges.length} get a creator`);

  const perOwner = new Map<string, number>();
  for (const owner of ownerOf.values()) perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);
  console.log("\nClients per owner after the backfill:");
  for (const user of staff) console.log(`  ${user.name} (${user.role}): ${perOwner.get(user.id) ?? 0}`);

  if (!apply) {
    console.log("\nDry run — nothing was written. Re-run with --apply to save these changes.\n");
    return;
  }

  await prisma.$transaction([
    ...clientChanges.map((change) =>
      prisma.client.update({ where: { id: change.id }, data: { ownerId: change.to } }),
    ),
    ...taskChanges.map((change) =>
      prisma.task.update({ where: { id: change.id }, data: { createdById: change.to } }),
    ),
  ]);
  console.log(`\nSaved: ${clientChanges.length} client owners, ${taskChanges.length} task creators.\n`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
