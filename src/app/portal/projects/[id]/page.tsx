import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PortalFileList } from "@/components/file-list";
import {
  BandBadge,
  PortalCard,
  PortalDetail,
  PortalEmpty,
  PortalH2,
  PortalHero,
  PortalMain,
  PortalPill,
  PortalProgress,
  PortalServiceList,
} from "@/components/portal-ui";
import { label } from "@/lib/constants";
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

const FAR_FUTURE = 9e15;

export default async function PortalProjectPage({ params }: { params: Params }) {
  const user = await requirePortalUser();
  const { id } = await params;

  // Scoped by clientId, so another client's project id simply 404s.
  const project = await getPortalProject(user.clientId, id);
  if (!project) notFound();

  // In-progress steps lead, then the soonest target date.
  const upcoming = project.tasks
    .filter((task) => task.status !== "DONE")
    .sort(
      (a, b) =>
        (a.status === "IN_PROGRESS" ? 0 : 1) - (b.status === "IN_PROGRESS" ? 0 : 1) ||
        (a.dueDate?.getTime() ?? FAR_FUTURE) - (b.dueDate?.getTime() ?? FAR_FUTURE),
    );
  const completed = project.tasks
    .filter((task) => task.status === "DONE")
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  const { progress } = project;

  return (
    <>
      <PortalHero
        title={project.name}
        sub={project.description ?? undefined}
        crumb={{ href: "/portal/projects", label: "Projects" }}
        action={<BandBadge value={project.status} />}
      />
      <PortalMain>
        <PortalCard raised className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] text-mu">Overall progress</span>
            <span className="text-[28px] font-semibold">{progress.percent}%</span>
          </div>
          <PortalProgress percent={progress.percent} height={12} />
          <div className="text-[12.5px] text-mu">
            {progress.total > 0
              ? `${progress.done} of ${plural(progress.total, "step")} complete · ${progress.inProgress} in progress`
              : "No steps published yet"}
          </div>
        </PortalCard>

        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <PortalCard className="pb-3">
              <PortalH2>What&rsquo;s next</PortalH2>
              {upcoming.length === 0 ? (
                <PortalEmpty>Every published step is done. We&rsquo;ll add more as the work moves on.</PortalEmpty>
              ) : (
                upcoming.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3 border-t border-ln py-2.5"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: task.status === "IN_PROGRESS" ? "var(--sky-d)" : "var(--slate-d)" }}
                      aria-label={label(task.status)}
                    />
                    <span className="text-[14px]">{task.title}</span>
                    <span className="text-[12.5px] whitespace-nowrap text-fa">
                      {task.dueDate ? `Target ${formatDate(task.dueDate)}` : ""}
                    </span>
                  </div>
                ))
              )}
              <div className="flex gap-3.5 pt-2.5 pb-1 text-[12px] text-fa">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: "var(--sky-d)" }} aria-hidden />
                  In progress
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: "var(--slate-d)" }} aria-hidden />
                  To do
                </span>
              </div>
            </PortalCard>

            <PortalCard className="pb-3">
              <PortalH2>Completed</PortalH2>
              {completed.length === 0 ? (
                <PortalEmpty>Nothing completed yet.</PortalEmpty>
              ) : (
                completed.map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 border-t border-ln py-[9px]"
                  >
                    <span
                      className="grid size-[18px] place-items-center rounded-full text-[11px]"
                      style={{ background: "var(--emerald-b)", color: "var(--emerald-f)" }}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="text-[14px] text-mu">{task.title}</span>
                  </div>
                ))
              )}
            </PortalCard>

            {project.services.length > 0 ? (
              <PortalCard className="pb-3">
                <PortalH2>Domain &amp; hosting</PortalH2>
                <PortalServiceList services={project.services} />
              </PortalCard>
            ) : null}

            <PortalCard className="pb-3">
              <PortalH2>Files for this project</PortalH2>
              <PortalFileList
                files={project.attachments}
                mode="shared"
                emptyText="No files for this project yet."
              />
            </PortalCard>
          </div>

          <div className="flex flex-col gap-4">
            <PortalCard>
              <PortalH2>Details</PortalH2>
              <PortalDetail term="Status">{label(project.status)}</PortalDetail>
              <PortalDetail term="Started">
                {project.startDate ? formatDate(project.startDate) : "Not started"}
              </PortalDetail>
              <PortalDetail term="Target finish">{formatDate(project.endDate)}</PortalDetail>
              {project.liveUrl ? (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 block rounded-[14px] bg-acs px-3.5 py-2.5 text-center text-[14px] font-medium"
                >
                  Open project ↗
                </a>
              ) : null}
            </PortalCard>

            <PortalCard className="pb-3">
              <PortalH2>Invoices</PortalH2>
              {project.invoices.length === 0 ? (
                <PortalEmpty bordered={false}>No invoices yet.</PortalEmpty>
              ) : (
                project.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/portal/invoices/${invoice.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-ln py-2.5 text-tx hover:text-tx"
                  >
                    <span>
                      <span className="block text-[14px] font-medium">{invoice.number}</span>
                      <span className="block text-[12.5px] text-fa">{formatMoney(invoice.totals.totalCents)}</span>
                    </span>
                    <PortalPill value={invoice.effectiveStatus} />
                  </Link>
                ))
              )}
            </PortalCard>
          </div>
        </div>
      </PortalMain>
    </>
  );
}
