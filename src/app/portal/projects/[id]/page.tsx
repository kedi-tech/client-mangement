import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";

import { FileList } from "@/components/file-list";
import { ProgressBar } from "@/components/progress-bar";
import {
  Badge,
  Card,
  CardHeader,
  DetailList,
  DetailRow,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { getPortalProject } from "@/server/queries";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const user = await requirePortalUser();
  const { id } = await params;
  const project = await getPortalProject(user.clientId, id);
  return { title: project?.name ?? "Project" };
}

export default async function PortalProjectPage({ params }: { params: Params }) {
  const user = await requirePortalUser();
  const { id } = await params;

  // Scoped by clientId, so another client's project id simply 404s.
  const project = await getPortalProject(user.clientId, id);
  if (!project) notFound();

  const upcoming = project.tasks.filter((task) => task.status !== "DONE");
  const completed = project.tasks.filter((task) => task.status === "DONE");

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        breadcrumb={
          <Link href="/portal/projects" className="hover:text-indigo-600 hover:underline">
            ← Projects
          </Link>
        }
        actions={
          <>
            <Badge value={project.status} className="self-center" />
            {project.liveUrl ? (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Visit project
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="size-4"
                  aria-hidden
                >
                  <path d="M14 4h6v6M20 4l-8 8M10 6H5v13h13v-5" />
                </svg>
              </a>
            ) : null}
          </>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">Overall progress</p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {project.progress.percent}%
          </p>
        </div>
        <ProgressBar
          className="mt-3"
          percent={project.progress.percent}
          label={
            project.progress.total > 0
              ? `${project.progress.done} of ${plural(project.progress.total, "step")} complete${
                  project.progress.inProgress > 0
                    ? ` · ${project.progress.inProgress} in progress`
                    : ""
                }`
              : "No steps published yet"
          }
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="What's next"
              description={`${plural(upcoming.length, "step")} remaining`}
            />
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing outstanding"
                description="Every published step is done. We'll add more as the work moves on."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcoming.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={clsx(
                        "size-2 shrink-0 rounded-full",
                        task.status === "IN_PROGRESS" ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900 dark:text-slate-100">{task.title}</p>
                      {task.dueDate ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Target {formatDate(task.dueDate)}
                        </p>
                      ) : null}
                    </div>
                    <Badge value={task.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {completed.length > 0 ? (
            <Card>
              <CardHeader title="Completed" description={plural(completed.length, "step")} />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {completed.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                      aria-hidden
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-2.5">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <p className="flex-1 text-sm text-slate-500 line-through dark:text-slate-400">
                      {task.title}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Project files" />
            <FileList
              files={project.attachments}
              perspective="portal"
              showProject={false}
              emptyTitle="No files for this project"
              emptyDescription="Files attached to this project will show up here."
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <DetailList>
              <DetailRow term="Status">
                <Badge value={project.status} />
              </DetailRow>
              <DetailRow term="Started">{formatDate(project.startDate)}</DetailRow>
              <DetailRow term="Target finish">{formatDate(project.endDate)}</DetailRow>
              {project.liveUrl ? (
                <DetailRow term="Link">
                  {/* Labelled rather than raw: a long URL wraps badly in this column. */}
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={project.liveUrl}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Open project
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="size-3.5"
                      aria-hidden
                    >
                      <path d="M14 4h6v6M20 4l-8 8M10 6H5v13h13v-5" />
                    </svg>
                  </a>
                </DetailRow>
              ) : null}
            </DetailList>
          </Card>

          {project.invoices.length > 0 ? (
            <Card>
              <CardHeader title="Invoices for this project" />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {project.invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/portal/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {formatMoney(invoice.totals.totalCents)}
                      </span>
                      <Badge value={invoice.effectiveStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
