import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { STAFF_ONLY } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { dateToInput } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { updateTaskAction } from "@/server/actions/tasks";
import { EditTaskForm } from "../../task-form";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const [task, clients, projects, users] = await Promise.all([
    prisma.task.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    prisma.user.findMany({
      where: STAFF_ONLY,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!task) notFound();

  const updateWithId = updateTaskAction.bind(null, task.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit task"
        breadcrumb={
          <Link href="/tasks" className="hover:text-indigo-600 hover:underline">
            ← Tasks
          </Link>
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
    </div>
  );
}
