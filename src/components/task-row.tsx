import { cn } from "@/lib/cn";

import { Badge, toneStyle } from "@/components/ui";
import { toneFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { toggleTaskAction } from "@/server/actions/tasks";

export type TaskRowTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
};

export function isTaskOverdue(task: { status: string; dueDate: Date | null }): boolean {
  return task.status !== "DONE" && task.dueDate !== null && task.dueDate.getTime() < Date.now();
}

/** "Overdue · Oct 2, 2026", "Due Nov 1, 2026" or "No due date". */
export function dueLabel(task: { status: string; dueDate: Date | null }): string {
  if (!task.dueDate) return "No due date";
  return `${isTaskOverdue(task) ? "Overdue · " : "Due "}${formatDate(task.dueDate)}`;
}

/** The small square checkbox that completes or reopens a task. */
export function TaskCheck({ task, className }: { task: { id: string; title: string; status: string }; className?: string }) {
  const done = task.status === "DONE";
  return (
    <form action={toggleTaskAction} className={cn("flex", className)}>
      <input type="hidden" name="taskId" value={task.id} />
      <button
        type="submit"
        title={done ? "Reopen" : "Mark complete"}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={cn(
          "grid size-3.5 place-items-center rounded-[3px] border-[1.5px] p-0 text-[10px] leading-none text-white",
          done ? "border-ac bg-ac" : "border-chk bg-transparent hover:border-ac",
        )}
      >
        {done ? "✓" : null}
      </button>
    </form>
  );
}

export function TaskTitle({ task, className }: { task: { title: string; status: string }; className?: string }) {
  const done = task.status === "DONE";
  return (
    <div className={cn(done ? "text-fa line-through" : "text-tx", className)}>{task.title}</div>
  );
}

/**
 * Compact task row used inside panels.
 *
 * - `dashboard`: "client · project" meta, uppercase priority, short due date
 * - `client`: "project · assignee" meta, status pill, due date
 * - `project`: assignee meta, status pill, due date
 */
export function TaskRow({
  task,
  variant = "dashboard",
}: {
  task: TaskRowTask;
  variant?: "dashboard" | "client" | "project";
}) {
  const overdue = isTaskOverdue(task);
  const dueColor = overdue ? "text-red" : "text-mu";
  const assignee = task.assignee?.name ?? "Unassigned";

  let meta: string;
  if (variant === "dashboard") {
    meta = [task.client?.name, task.project?.name].filter(Boolean).join(" · ") || "No client";
  } else if (variant === "client") {
    meta = `${task.project?.name ?? "No project"} · ${assignee}`;
  } else {
    meta = assignee;
  }

  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-l2 px-3.5 py-2 text-[12.5px] last:border-b-0">
      <TaskCheck task={task} />
      <div className="min-w-0">
        <TaskTitle task={task} className="truncate" />
        <div className="truncate text-[11.5px] text-fa">{meta}</div>
      </div>
      <div className="flex items-center gap-2">
        {variant === "dashboard" ? (
          <>
            <span
              className="text-[10.5px] font-semibold tracking-[.04em]"
              style={{ color: toneStyle(toneFor(task.priority)).f }}
            >
              {task.priority}
            </span>
            <span className={cn("font-mono text-[11.5px] whitespace-nowrap", dueColor)}>
              {task.dueDate ? formatDate(task.dueDate).replace(/, \d{4}$/, "") : "—"}
            </span>
          </>
        ) : (
          <>
            <Badge value={task.status} />
            <span
              className={cn(
                "text-[12px] whitespace-nowrap",
                dueColor,
                variant === "project" && "min-[720px]:min-w-[150px] min-[720px]:text-right",
              )}
            >
              {dueLabel(task)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
