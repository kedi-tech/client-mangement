import type { Metadata } from "next";
import Link from "next/link";

import { ProgressBar } from "@/components/progress-bar";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { getPortalOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Projects" };

export default async function PortalProjectsPage() {
  const user = await requirePortalUser();
  const { projects } = await getPortalOverview(user.clientId);

  return (
    <>
      <PageHeader title="Projects" description="Everything we are building for you." />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects yet"
            description="As soon as work is scoped, it will appear here with live progress."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Card key={project.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/portal/projects/${project.id}`}
                    className="text-base font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-50 dark:hover:text-indigo-400"
                  >
                    {project.name}
                  </Link>
                  {project.description ? (
                    <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                      {project.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {project.startDate ? `Started ${formatDate(project.startDate)}` : "Not started"}
                    {project.endDate ? ` · target ${formatDate(project.endDate)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={project.status} />
                  {project.liveUrl ? (
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Visit project
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
                  ) : null}
                </div>
              </div>

              <ProgressBar
                className="mt-4"
                percent={project.progress.percent}
                label={
                  project.progress.total > 0
                    ? `${project.progress.percent}% complete · ${project.progress.done} of ${plural(project.progress.total, "step")}${
                        project.progress.inProgress > 0
                          ? ` · ${project.progress.inProgress} in progress`
                          : ""
                      }`
                    : "No steps published yet"
                }
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
