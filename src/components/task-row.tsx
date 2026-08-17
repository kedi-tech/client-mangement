import Link from "next/link";
import clsx from "clsx";

import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { toggleTaskAction } from "@/server/actions/tasks";

export type TaskRowTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  client?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
};

/** Shared between the dashboard, the task list and the client/project details. */
export function TaskRow({ task, showClient = true }: { task: TaskRowTask; showClient?: boolean }) {
  const done = task.status === "DONE";
  const overdue = !done && task.dueDate !== null && task.dueDate.getTime() < Date.now();

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <form action={toggleTaskAction} className="pt-0.5">
        <input type="hidden" name="taskId" value={task.id} />
        <button
          type="submit"
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          className={clsx(
            "flex size-5 items-center justify-center rounded-md border transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 hover:border-indigo-500 dark:border-slate-600",
          )}
        >
          {done ? (
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
            done
              ? "text-slate-400 line-through dark:text-slate-500"
              : "text-slate-900 dark:text-slate-100",
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {showClient && task.client ? (
            <Link href={`/clients/${task.client.id}`} className="hover:text-indigo-600 hover:underline">
              {task.client.name}
            </Link>
          ) : null}
          {task.dueDate ? (
            <span className={overdue ? "font-medium text-rose-600 dark:text-rose-400" : undefined}>
              {overdue ? "Overdue · " : "Due "}
              {formatDate(task.dueDate)}
            </span>
          ) : null}
          {task.assignee ? <span>{task.assignee.name}</span> : null}
        </div>
      </div>

      <Badge value={task.priority} />
    </li>
  );
}
