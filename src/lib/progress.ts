/** Tasks summarised as client-facing progress for one project. */
export function projectProgress(tasks: { status: string }[]) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "DONE").length;
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  return {
    total,
    done,
    inProgress,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export type ProjectProgress = ReturnType<typeof projectProgress>;
