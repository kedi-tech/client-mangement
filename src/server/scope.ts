import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";

/*
 * Data ownership for staff.
 *
 * Every staff account — member, admin and super admin alike — sees only the
 * clients it owns (Client.ownerId) and what hangs off them: contacts, projects,
 * tasks, invoices, notes, files and the client's activity. Roles govern account
 * administration, never client visibility.
 *
 * All reads add one of these filters, and every mutation loads its target
 * through an `owned…` helper first, so an id from another member's account
 * behaves exactly like an id that does not exist.
 */

type Staff = Pick<CurrentUser, "id">;

/** Clients the user owns. */
export function clientScope(user: Staff): Prisma.ClientWhereInput {
  return { ownerId: user.id };
}

/** Anything with a required `client` relation (contacts, projects, invoices, notes, files). */
export function viaClient(user: Staff) {
  return { client: { ownerId: user.id } };
}

/** Tasks on the user's clients, plus client-less tasks the user created. */
export function taskScope(user: Staff): Prisma.TaskWhereInput {
  return {
    OR: [{ client: { ownerId: user.id } }, { clientId: null, createdById: user.id }],
  };
}

/** Activity about the user's clients, plus the user's own non-client actions. */
export function activityScope(user: Staff): Prisma.ActivityWhereInput {
  return {
    OR: [{ client: { ownerId: user.id } }, { clientId: null, actorId: user.id }],
  };
}

/* ------------------------------------------------------- guarded loaders */

export function ownedClient(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.client.findFirst({ where: { id, ownerId: user.id } });
}

export function ownedContact(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.contact.findFirst({ where: { id, ...viaClient(user) } });
}

export function ownedProject(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.project.findFirst({ where: { id, ...viaClient(user) } });
}

export function ownedInvoice(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.invoice.findFirst({ where: { id, ...viaClient(user) } });
}

export function ownedNote(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.note.findFirst({ where: { id, ...viaClient(user) } });
}

export function ownedAttachment(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.attachment.findFirst({ where: { id, ...viaClient(user) } });
}

export function ownedService(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.service.findFirst({ where: { id, ...viaClient(user) } });
}

export function ownedTask(user: Staff, id: string) {
  if (!id) return Promise.resolve(null);
  return prisma.task.findFirst({ where: { AND: [{ id }, taskScope(user)] } });
}

/**
 * An account with portal access to one of the user's clients. By default only
 * plain CLIENT logins; pass `anyRole` to include a staff member who is also
 * that client (e.g. to remove their portal access).
 */
export function ownedPortalUser(user: Staff, id: string, { anyRole = false } = {}) {
  if (!id) return Promise.resolve(null);
  return prisma.user.findFirst({
    where: { id, ...(anyRole ? {} : { role: "CLIENT" }), portalClient: { ownerId: user.id } },
    select: { id: true, email: true, clientId: true, name: true, role: true },
  });
}
