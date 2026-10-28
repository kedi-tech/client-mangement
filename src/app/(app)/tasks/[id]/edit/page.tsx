import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateToInput } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { clientScope, taskScope, viaClient } from "@/server/scope";
import { updateTaskAction } from "@/server/actions/tasks";
import { EditTaskForm } from "../../task-form";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [task, clients, projects, users] = await Promise.all([
    prisma.task.findFirst({ where: { AND: [{ id }, taskScope(user)] } }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: viaClient(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    Promise.resolve([{ id: user.id, name: user.name }]),
  ]);

  if (!task) notFound();

  const updateWithId = updateTaskAction.bind(null, task.id);

  return (
    <>
      <PageHeader
        title="Edit task"
        breadcrumb={
          <BackLink href={"/tasks"}>Tasks</BackLink>
        }
      />
      <EditTaskForm
        action={updateWithId}
        clients={clients}
        projects={projects}
        users={users}
        cancelHref="/tasks"
        values={{
          title: task.title,
          description: task.description ?? "",
          status: task.status,
          priority: task.priority,
          dueDate: dateToInput(task.dueDate),
          clientId: task.clientId ?? "",
          projectId: task.projectId ?? "",
          assigneeId: task.assigneeId ?? "",
        }}
      />
    </>
  );
}
