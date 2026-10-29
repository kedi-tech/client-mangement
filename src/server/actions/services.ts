"use server";

import { revalidatePath } from "next/cache";

import { PROVIDED_BY_LABELS, SERVICE_KIND_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { serviceSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";
import { ownedProject, ownedService } from "@/server/scope";

/*
 * Domains and hosting plans on a project: who paid for them, where they live,
 * and when they renew. Only the owner of the project's client can see or
 * change them.
 */

function readServiceForm(formData: FormData) {
  return serviceSchema.safeParse({
    projectId: formData.get("projectId"),
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
  const { price, projectId: _projectId, ...rest } = parsed.data;
  return { ...rest, priceCents: price };
}

function revalidate(service: { clientId: string; projectId: string }) {
  revalidatePath(`/projects/${service.projectId}`);
  revalidatePath(`/clients/${service.clientId}`);
  revalidatePath("/portal", "layout");
}

export async function createServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readServiceForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const project = await ownedProject(user, parsed.data.projectId);
  if (!project) return { error: "That project no longer exists." };

  const service = await prisma.service.create({
    data: { ...toData(parsed), projectId: project.id, clientId: project.clientId },
  });

  await logActivity({
    type: "SERVICE_ADDED",
    message: `${SERVICE_KIND_LABELS[service.kind]} ${service.name} added to "${project.name}" (${PROVIDED_BY_LABELS[service.providedBy].toLowerCase()})`,
    actorId: user.id,
    clientId: project.clientId,
    entityType: "Service",
    entityId: service.id,
  });

  revalidate(service);
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

  // A service stays on the project it was created for.
  const service = await prisma.service.update({ where: { id: existing.id }, data: toData(parsed) });

  await logActivity({
    type: "SERVICE_UPDATED",
    message: `${SERVICE_KIND_LABELS[service.kind]} ${service.name} was updated`,
    actorId: user.id,
    clientId: service.clientId,
    entityType: "Service",
    entityId: service.id,
  });

  revalidate(service);
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

  revalidate(service);
}
