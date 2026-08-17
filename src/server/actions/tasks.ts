"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { taskSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

function readTaskForm(formData: FormData) {
  return taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    assigneeId: formData.get("assigneeId"),
  });
}

/**
 * A task can be attached to a project, a client, or neither — but if a project
 * is chosen the client must be the project's own client.
 */
async function resolveLinks(clientId?: string, projectId?: string) {
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) return { clientId: project.clientId, projectId: project.id };
  }
  return { clientId: clientId ?? null, projectId: null };
}

export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readTaskForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { clientId, projectId, assigneeId, status, ...rest } = parsed.data;
  const links = await resolveLinks(clientId, projectId);

  const task = await prisma.task.create({
    data: {
      ...rest,
      status,
      ...links,
      assigneeId: assigneeId ?? null,
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  await logActivity({
    type: "TASK_CREATED",
    message: `Task "${task.title}" was created`,
    actorId: user.id,
    clientId: task.clientId,
    entityType: "Task",
    entityId: task.id,
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.clientId) revalidatePath(`/clients/${task.clientId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true };
}

export async function updateTaskAction(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = readTaskForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { error: "That task no longer exists." };

  const { clientId, projectId, assigneeId, status, ...rest } = parsed.data;
  const links = await resolveLinks(clientId, projectId);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...rest,
      status,
      ...links,
      assigneeId: assigneeId ?? null,
      completedAt:
        status === "DONE" ? (existing.completedAt ?? new Date()) : null,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.clientId) revalidatePath(`/clients/${task.clientId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  redirect("/tasks");
}

/** Checkbox toggle used on the task list, dashboard and detail pages. */
export async function toggleTaskAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const nowDone = task.status !== "DONE";
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: nowDone ? "DONE" : "TODO",
      completedAt: nowDone ? new Date() : null,
    },
  });

  if (nowDone) {
    await logActivity({
      type: "TASK_COMPLETED",
      message: `Task "${task.title}" was completed`,
      actorId: user.id,
      clientId: task.clientId,
      entityType: "Task",
      entityId: task.id,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.clientId) revalidatePath(`/clients/${task.clientId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.clientId) revalidatePath(`/clients/${task.clientId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
}
