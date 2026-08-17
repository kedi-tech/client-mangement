"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { clientSchema, noteSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

function readClientForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    industry: formData.get("industry"),
    status: formData.get("status"),
    addressLine: formData.get("addressLine"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    notes: formData.get("notes"),
    ownerId: formData.get("ownerId"),
  });
}

export async function createClientAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readClientForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const client = await prisma.client.create({
    data: { ...parsed.data, ownerId: parsed.data.ownerId ?? user.id },
  });

  await logActivity({
    type: "CLIENT_CREATED",
    message: `${client.name} was added as a client`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Client",
    entityId: client.id,
  });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readClientForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) return { error: "That client no longer exists." };

  const client = await prisma.client.update({
    where: { id: clientId },
    data: { ...parsed.data, ownerId: parsed.data.ownerId ?? null },
  });

  await logActivity({
    type: existing.status === client.status ? "CLIENT_UPDATED" : "CLIENT_STATUS_CHANGED",
    message:
      existing.status === client.status
        ? `${client.name}'s details were updated`
        : `${client.name} moved from ${existing.status} to ${client.status}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Client",
    entityId: client.id,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  redirect(`/clients/${clientId}`);
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) redirect("/clients");

  // Contacts, projects, tasks, invoices and notes cascade with the client.
  await prisma.client.delete({ where: { id: clientId } });

  await logActivity({
    type: "CLIENT_DELETED",
    message: `${client.name} was deleted`,
    actorId: user.id,
    entityType: "Client",
    entityId: clientId,
  });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect("/clients");
}

export async function addNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse({
    clientId: formData.get("clientId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return { error: "That client no longer exists." };

  await prisma.note.create({
    data: { clientId: client.id, authorId: user.id, body: parsed.data.body },
  });

  await logActivity({
    type: "NOTE_ADDED",
    message: `Note added to ${client.name}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Client",
    entityId: client.id,
  });

  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return;

  await prisma.note.delete({ where: { id: noteId } });
  revalidatePath(`/clients/${note.clientId}`);
}
