"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { contactSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

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

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
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
  await requireUser();
  const parsed = readContactForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const contact = await prisma.contact.update({ where: { id: contactId }, data: parsed.data });
  if (contact.isPrimary) await enforceSinglePrimary(contact.clientId, contact.id);

  revalidatePath(`/clients/${contact.clientId}`);
  revalidatePath("/contacts");
  redirect(`/clients/${contact.clientId}`);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return;

  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath(`/clients/${contact.clientId}`);
  revalidatePath("/contacts");
}
