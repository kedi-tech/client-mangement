"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { contactSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";
import { ownedClient, ownedContact } from "@/server/scope";

function readContactForm(formData: FormData) {
  return contactSchema.safeParse({
    clientId: formData.get("clientId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    title: formData.get("title"),
    isPrimary: formData.get("isPrimary") ?? undefined,
  });
}

/** A client has at most one primary contact — demote the others. */
async function enforceSinglePrimary(clientId: string, contactId: string) {
  await prisma.contact.updateMany({
    where: { clientId, id: { not: contactId } },
    data: { isPrimary: false },
  });
}

export async function createContactAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readContactForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const client = await ownedClient(user, parsed.data.clientId);
  if (!client) return { error: "That client no longer exists." };

  const contact = await prisma.contact.create({ data: parsed.data });
  if (contact.isPrimary) await enforceSinglePrimary(client.id, contact.id);

  await logActivity({
    type: "CONTACT_ADDED",
    message: `${contact.firstName} ${contact.lastName} was added as a contact at ${client.name}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Contact",
    entityId: contact.id,
  });

  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateContactAction(
  contactId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readContactForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  // Both the contact and the client it is moved to must be the user's.
  const existing = await ownedContact(user, contactId);
  if (!existing) return { error: "That contact no longer exists." };
  if (!(await ownedClient(user, parsed.data.clientId))) {
    return { fieldErrors: { clientId: ["Choose one of your clients."] } };
  }

  const contact = await prisma.contact.update({ where: { id: existing.id }, data: parsed.data });
  if (contact.isPrimary) await enforceSinglePrimary(contact.clientId, contact.id);

  revalidatePath(`/clients/${contact.clientId}`);
  revalidatePath("/contacts");
  redirect(`/clients/${contact.clientId}`);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const contact = await ownedContact(user, String(formData.get("contactId") ?? ""));
  if (!contact) return;

  await prisma.contact.delete({ where: { id: contact.id } });
  revalidatePath(`/clients/${contact.clientId}`);
  revalidatePath("/contacts");
}
