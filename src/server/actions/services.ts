"use server";

import { revalidatePath } from "next/cache";

import { PROVIDED_BY_LABELS, SERVICE_KIND_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { serviceSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";
import { ownedClient, ownedService } from "@/server/scope";

/*
 * Domains and hosting plans on a client: who paid for them, where they live,
 * and when they renew. Only the client's owner can see or change them.
 */

function readServiceForm(formData: FormData) {
  return serviceSchema.safeParse({
    clientId: formData.get("clientId"),
    kind: formData.get("kind"),
    name: formData.get("name"),
    providedBy: formData.get("providedBy"),
    provider: formData.get("provider"),
    renewsAt: formData.get("renewsAt"),
    price: formData.get("price"),
    notes: formData.get("notes"),
  });
}

function toData(parsed: ReturnType<typeof readServiceForm> & { success: true }) {
  const { price, clientId: _clientId, ...rest } = parsed.data;
  return { ...rest, priceCents: price };
}

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
}

export async function createServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readServiceForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const client = await ownedClient(user, parsed.data.clientId);
  if (!client) return { error: "That client no longer exists." };

  const service = await prisma.service.create({ data: { ...toData(parsed), clientId: client.id } });

  await logActivity({
    type: "SERVICE_ADDED",
    message: `${SERVICE_KIND_LABELS[service.kind]} ${service.name} added for ${client.name} (${PROVIDED_BY_LABELS[service.providedBy].toLowerCase()})`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Service",
    entityId: service.id,
  });

  revalidate(client.id);
  return { ok: true };
}

export async function updateServiceAction(
  serviceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readServiceForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const existing = await ownedService(user, serviceId);
  if (!existing) return { error: "That domain or hosting plan no longer exists." };

  // A service stays on the client it was created for.
  const service = await prisma.service.update({ where: { id: existing.id }, data: toData(parsed) });

  await logActivity({
    type: "SERVICE_UPDATED",
    message: `${SERVICE_KIND_LABELS[service.kind]} ${service.name} was updated`,
    actorId: user.id,
    clientId: service.clientId,
    entityType: "Service",
    entityId: service.id,
  });

  revalidate(service.clientId);
  return { ok: true };
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const service = await ownedService(user, String(formData.get("serviceId") ?? ""));
  if (!service) return;

  await prisma.service.delete({ where: { id: service.id } });

  await logActivity({
    type: "SERVICE_REMOVED",
    message: `${SERVICE_KIND_LABELS[service.kind]} ${service.name} was removed`,
    actorId: user.id,
    clientId: service.clientId,
    entityType: "Service",
    entityId: service.id,
  });

  revalidate(service.clientId);
}
