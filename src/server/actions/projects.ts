"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { projectSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

function readProjectForm(formData: FormData) {
  return projectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    description: formData.get("description"),
    status: formData.get("status"),
    budget: formData.get("budget"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
}

function validateDateOrder(startDate?: Date, endDate?: Date): FormState | null {
  if (startDate && endDate && endDate < startDate) {
    return { fieldErrors: { endDate: ["End date cannot be before the start date"] } };
  }
  return null;
}

export async function createProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readProjectForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const orderError = validateDateOrder(parsed.data.startDate, parsed.data.endDate);
  if (orderError) return orderError;

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return { error: "That client no longer exists." };

  const { budget, ...rest } = parsed.data;
  const project = await prisma.project.create({
    data: { ...rest, budgetCents: budget },
  });

  await logActivity({
    type: "PROJECT_CREATED",
    message: `Project "${project.name}" started for ${client.name}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Project",
    entityId: project.id,
  });

  revalidatePath("/projects");
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readProjectForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const orderError = validateDateOrder(parsed.data.startDate, parsed.data.endDate);
  if (orderError) return orderError;

  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) return { error: "That project no longer exists." };

  const { budget, ...rest } = parsed.data;
  const project = await prisma.project.update({
    where: { id: projectId },
    data: { ...rest, budgetCents: budget },
  });

  if (existing.status !== project.status) {
    await logActivity({
      type: "PROJECT_STATUS_CHANGED",
      message: `Project "${project.name}" moved from ${existing.status} to ${project.status}`,
      actorId: user.id,
      clientId: project.clientId,
      entityType: "Project",
      entityId: project.id,
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/dashboard");
  redirect(`/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/projects");

  await prisma.project.delete({ where: { id: projectId } });

  await logActivity({
    type: "PROJECT_DELETED",
    message: `Project "${project.name}" was deleted`,
    actorId: user.id,
    clientId: project.clientId,
    entityType: "Project",
    entityId: projectId,
  });

  revalidatePath("/projects");
  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/dashboard");
  redirect("/projects");
}
