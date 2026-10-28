import type { Metadata } from "next";
import Link from "next/link";

import { RowActions } from "@/components/row-actions";
import { FilterBar, FilterSelect } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import { TaskCheck, TaskTitle, dueLabel, isTaskOverdue } from "@/components/task-row";
import { Badge, Card, CardHeader, EmptyRow, LinkButton } from "@/components/ui";
import { TASK_PRIORITIES, TASK_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { emptyTask } from "@/lib/form-defaults";
import { like } from "@/lib/search";
import { requireUser } from "@/lib/session";
import { clientScope, taskScope, viaClient } from "@/server/scope";
import { createTaskAction, deleteTaskAction } from "@/server/actions/tasks";
import { TasksHeader } from "./task-form";

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

  const where = {
    AND: [taskScope(user)],
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(q ? { OR: [{ title: like(q) }, { description: like(q) }] } : {}),
  };

  const [tasks, clients, projects, users, totalTasks] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: viaClient(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    Promise.resolve([{ id: user.id, name: user.name }]),
    prisma.task.count({ where: taskScope(user) }),
  ]);

  const open = tasks.filter((task) => task.status !== "DONE");
  const done = tasks.filter((task) => task.status === "DONE");
  const overdueCount = open.filter(isTaskOverdue).length;
  const filteredProject = projectId ? projects.find((project) => project.id === projectId) : null;

  // Link that drops just the project filter, keeping the rest.
  const clearProjectParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "projectId") clearProjectParams.set(key, value);
  }
  const clearProjectHref = clearProjectParams.size ? `/tasks?${clearProjectParams}` : "/tasks";

  const sections = [
    {
      title: "Open",
      rows: open,
      emptyText:
        tasks.length || totalTasks ? "Nothing open here." : "No tasks yet. Add one to keep the next step visible.",
    },
    { title: "Completed", rows: done, emptyText: "Nothing completed yet." },
  ];

  return (
    <>
      <TasksHeader
        description={`${open.length} open · ${overdueCount ? `${overdueCount} overdue` : "nothing overdue"}`}
        descriptionWarn={overdueCount > 0}
        action={createTaskAction}
        clients={clients}
        projects={projects}
        users={users}
        defaults={{
          ...emptyTask,
          clientId,
          projectId,
          assigneeId: user.id,
        }}
      />

      <FilterBar>
        <SearchInput placeholder="Search title or description" className="flex-[1_1_220px]" />
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
      </FilterBar>

      {filteredProject ? (
        <div className="flex items-center gap-2 text-[12.5px] text-mu">
          Showing tasks for <strong className="font-medium text-tx">{filteredProject.name}</strong>
          <LinkButton href={clearProjectHref} variant="secondary" size="sm" className="px-2 py-px">
            Clear
          </LinkButton>
        </div>
      ) : null}

      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader title={section.title} description={section.rows.length} />
          {section.rows.length === 0 ? (
            <EmptyRow>{section.emptyText}</EmptyRow>
          ) : (
            section.rows.map((task) => {
              const overdue = isTaskOverdue(task);
              return (
                <div
                  key={task.id}
                  className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 border-b border-l2 px-3.5 py-2.5 last:border-b-0"
                >
                  <TaskCheck task={task} className="mt-0.5" />
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <TaskTitle task={task} className="text-[13.5px]" />
                    {task.description ? (
                      <div className="text-[12.5px] text-mu">{task.description}</div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px] text-fa">
                      {task.client ? <Link href={`/clients/${task.client.id}`}>{task.client.name}</Link> : null}
                      {task.project ? (
                        <Link href={`/projects/${task.project.id}`} className="text-mu hover:text-ac">
                          {task.project.name}
                        </Link>
                      ) : null}
                      <Badge value={task.priority} />
                      <span className={overdue ? "text-red" : "text-mu"}>{dueLabel(task)}</span>
                    </div>
                  </div>
                  <RowActions
                    editHref={`/tasks/${task.id}/edit`}
                    remove={{
                      action: deleteTaskAction,
                      hidden: { taskId: task.id },
                      confirmMessage: `Delete task "${task.title}"?`,
                    }}
                  />
                </div>
              );
            })
          )}
        </Card>
      ))}
    </>
  );
}
