import type { Metadata } from "next";
import Link from "next/link";

import { PortalCard, PortalHero, PortalMain, PortalPill, PortalProgress } from "@/components/portal-ui";
import { formatDate, plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { getPortalOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Projects" };

/** Work in flight first, then what is paused or finished. */
const STATUS_ORDER = ["ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED", "CANCELLED"];

export default async function PortalProjectsPage() {
  const user = await requirePortalUser();
  const { projects } = await getPortalOverview(user.clientId);

  const sorted = [...projects].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <>
      <PortalHero title="Projects" sub="Everything we are working on for you." />
      <PortalMain>
        {sorted.length === 0 ? (
          <PortalCard raised className="px-[22px] py-10 text-center text-[14px] text-mu">
            No projects yet. Once work starts, it will show up here.
          </PortalCard>
        ) : (
          sorted.map((project) => (
            <PortalCard key={project.id} raised className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-x-3.5 gap-y-2">
                <div className="min-w-0 flex-[1_1_300px]">
                  <Link href={`/portal/projects/${project.id}`} className="text-[17px] font-semibold text-tx">
                    {project.name}
                  </Link>
                  {project.description ? (
                    <div className="mt-1 text-[14px] text-mu">{project.description}</div>
                  ) : null}
                  <div className="mt-1.5 text-[13px] text-fa">
                    {project.startDate ? `Started ${formatDate(project.startDate)}` : "Not started"}
                    {project.endDate ? ` · target ${formatDate(project.endDate)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  {project.liveUrl ? (
                    <a href={project.liveUrl} target="_blank" rel="noreferrer noopener" className="text-[13px]">
                      Visit project ↗
                    </a>
                  ) : null}
                  <PortalPill value={project.status} />
                </div>
              </div>
              <PortalProgress percent={project.progress.percent} />
              <div className="text-[12.5px] text-mu">
                {project.progress.total > 0
                  ? `${project.progress.percent}% complete · ${project.progress.done} of ${plural(project.progress.total, "step")} · ${project.progress.inProgress} in progress`
                  : "No steps published yet"}
              </div>
            </PortalCard>
          ))
        )}
      </PortalMain>
    </>
  );
}
