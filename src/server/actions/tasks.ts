"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { taskSchema, toFieldErrors, type FormState } from "@/lib/validation";
import type { CurrentUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { ownedClient, ownedProject, ownedTask } from "@/server/scope";

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
 * is chosen the client must be the project's own client. Only the user's own
 * clients and projects can be linked; anything else is dropped.
 */
async function resolveLinks(user: CurrentUser, clientId?: string, projectId?: string) {
  if (projectId) {
    const project = await ownedProject(user, projectId);
    if (project) return { clientId: project.clientId, projectId: project.id };
  }
  const client = clientId ? await ownedClient(user, clientId) : null;
  return { clientId: client?.id ?? null, projectId: null };
}

/**
 * Staff see only their own clients, so a task can only be assigned to its
 * creator (or nobody) — anyone else could not see it.
 */
function resolveAssignee(user: CurrentUser, assigneeId?: string): string | null {
  return assigneeId === user.id ? user.id : null;
}

export async function createTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readTaskForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { clientId, projectId, assigneeId, status, ...rest } = parsed.data;
  const links = await resolveLinks(user, clientId, projectId);

  const task = await prisma.task.create({
    data: {
      ...rest,
      status,
      ...links,
      assigneeId: resolveAssignee(user, assigneeId),
      createdById: user.id,
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
  const user = await requireUser();
  const parsed = readTaskForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const existing = await ownedTask(user, taskId);
  if (!existing) return { error: "That task no longer exists." };

  const { clientId, projectId, assigneeId, status, ...rest } = parsed.data;
  const links = await resolveLinks(user, clientId, projectId);

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...rest,
      status,
      ...links,
      assigneeId: resolveAssignee(user, assigneeId),
      // A task moved off its client stays visible to whoever moved it.
      createdById: existing.createdById ?? user.id,
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
  const task = await ownedTask(user, String(formData.get("taskId") ?? ""));
  if (!task) return;

  const nowDone = task.status !== "DONE";
  await prisma.task.update({
    where: { id: task.id },
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
  const user = await requireUser();
  const task = await ownedTask(user, String(formData.get("taskId") ?? ""));
  if (!task) return;

  await prisma.task.delete({ where: { id: task.id } });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (task.clientId) revalidatePath(`/clients/${task.clientId}`);
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
}
