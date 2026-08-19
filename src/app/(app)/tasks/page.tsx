import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";

import { ConfirmForm } from "@/components/confirm-form";
import { FilterSelect } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { STAFF_ONLY, TASK_PRIORITIES, TASK_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { like } from "@/lib/search";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { emptyTask } from "@/lib/form-defaults";
import { createTaskAction, deleteTaskAction, toggleTaskAction } from "@/server/actions/tasks";
import { NewTaskPanel } from "./task-form";

export const metadata: Metadata = { title: "Tasks" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const priority = params.priority ?? "";
  const clientId = params.clientId ?? "";
  const projectId = params.projectId ?? "";
  const assigneeId = params.assigneeId ?? "";

  const where = {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(q ? { OR: [{ title: like(q) }, { description: like(q) }] } : {}),
  };

  const [tasks, clients, projects, users] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
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

  const open = tasks.filter((task) => task.status !== "DONE");
  const done = tasks.filter((task) => task.status === "DONE");
  const overdueCount = open.filter(
    (task) => task.dueDate !== null && task.dueDate.getTime() < Date.now(),
  ).length;

  function TaskItem({ task }: { task: (typeof tasks)[number] }) {
    const isDone = task.status === "DONE";
    const overdue = !isDone && task.dueDate !== null && task.dueDate.getTime() < Date.now();

    return (
      <li className="flex items-start gap-3 px-5 py-3">
        <form action={toggleTaskAction} className="pt-0.5">
          <input type="hidden" name="taskId" value={task.id} />
          <button
            type="submit"
            aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={clsx(
              "flex size-5 items-center justify-center rounded-md border transition-colors",
              isDone
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 hover:border-indigo-500 dark:border-slate-600",
            )}
          >
            {isDone ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "text-sm font-medium",
              isDone
                ? "text-slate-400 line-through dark:text-slate-500"
                : "text-slate-900 dark:text-slate-100",
            )}
          >
            {task.title}
          </p>
          {task.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              {task.description}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {task.client ? (
              <Link href={`/clients/${task.client.id}`} className="hover:text-indigo-600 hover:underline">
                {task.client.name}
              </Link>
            ) : null}
            {task.project ? (
              <Link href={`/projects/${task.project.id}`} className="hover:text-indigo-600 hover:underline">
                {task.project.name}
              </Link>
            ) : null}
            {task.dueDate ? (
              <span className={overdue ? "font-medium text-rose-600 dark:text-rose-400" : undefined}>
                {overdue ? "Overdue · " : "Due "}
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            {task.assignee ? <span>{task.assignee.name}</span> : <span>Unassigned</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge value={task.priority} />
          <Link
            href={`/tasks/${task.id}/edit`}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Edit
          </Link>
          <ConfirmForm
            action={deleteTaskAction}
            hidden={{ taskId: task.id }}
            confirmMessage={`Delete "${task.title}"?`}
            variant="subtle"
          >
            Delete
          </ConfirmForm>
        </div>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description={
          overdueCount > 0
            ? `${open.length} open · ${overdueCount} overdue`
            : `${open.length} open · nothing overdue`
        }
        actions={
          <NewTaskPanel
            action={createTaskAction}
            clients={clients}
            projects={projects}
            users={users}
            defaults={{
              ...emptyTask,
              clientId,
              projectId,
              assigneeId: assigneeId || user.id,
            }}
          />
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search tasks…" />
          </div>
          <FilterSelect
            name="status"
            label="Status"
            allLabel="Any status"
            options={TASK_STATUSES.map((value) => ({ value, label: label(value) }))}
          />
          <FilterSelect
            name="priority"
            label="Priority"
            allLabel="Any priority"
            options={TASK_PRIORITIES.map((value) => ({ value, label: label(value) }))}
          />
          <FilterSelect
            name="clientId"
            label="Client"
            allLabel="All clients"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
          />
          <FilterSelect
            name="assigneeId"
            label="Assignee"
            allLabel="Anyone"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Open" description={`${open.length} tasks`} />
          {open.length === 0 ? (
            <EmptyState title="Nothing open" description="Every task matching these filters is done." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {open.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          )}
        </Card>

        {done.length > 0 ? (
          <Card>
            <CardHeader title="Completed" description={`${done.length} tasks`} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {done.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
