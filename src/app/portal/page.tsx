import type { Metadata } from "next";
import Link from "next/link";

import { PortalFileList } from "@/components/file-list";
import {
  BandButton,
  PortalCard,
  PortalCardHead,
  PortalEmpty,
  PortalHero,
  PortalMain,
  PortalPill,
  PortalProgress,
} from "@/components/portal-ui";
import { formatDate, formatMoney, plural } from "@/lib/format";
import { requirePortalUser } from "@/lib/session";
import { getPortalOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Portal" };

export default async function PortalHomePage() {
  const user = await requirePortalUser();
  const data = await getPortalOverview(user.clientId);
  const { totals } = data;

  const activeProjects = data.projects.filter(
    (project) => project.status === "ACTIVE" || project.status === "PLANNING",
  );
  const unpaid = data.invoices
    .filter((invoice) => invoice.effectiveStatus === "SENT" || invoice.effectiveStatus === "OVERDUE")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 4);

  return (
    <>
      <PortalHero
        title={`Hello, ${user.name.split(" ")[0]}`}
        action={<BandButton href="/portal/files">Send us a file</BandButton>}
      />
      <PortalMain>
        <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
          <PortalCard raised>
            <div className="text-[13.5px] text-mu">Active projects</div>
            <div className="mt-1.5 text-[32px] font-semibold">{totals.activeProjects}</div>
          </PortalCard>
          <PortalCard raised>
            <div className="text-[13.5px] text-mu">Balance due</div>
            <div className={`mt-1.5 text-[32px] font-semibold ${totals.outstandingCents > 0 ? "" : "text-grn"}`}>
              {formatMoney(totals.outstandingCents)}
            </div>
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-[3px] text-[12px] font-medium"
              style={
                totals.overdueCount > 0
                  ? { background: "var(--rose-b)", color: "var(--rose-f)" }
                  : { background: "var(--emerald-b)", color: "var(--emerald-f)" }
              }
            >
              {totals.overdueCount > 0 ? `${formatMoney(totals.overdueCents)} past due` : "Nothing past due"}
            </span>
          </PortalCard>
          <PortalCard raised>
            <div className="text-[13.5px] text-mu">Paid to date</div>
            <div className="mt-1.5 text-[32px] font-semibold">{formatMoney(totals.paidCents)}</div>
          </PortalCard>
        </div>

        <PortalCard>
          <h2 className="m-0 mb-1.5 text-[17px] font-semibold">Project progress</h2>
          {activeProjects.length === 0 ? (
            <div className="border-t border-ln pt-5 pb-1.5 text-[14px] text-mu">
              Once work starts, its progress will show up here.
            </div>
          ) : (
            activeProjects.map((project) => (
              <div key={project.id} className="flex flex-col gap-2.5 border-t border-ln py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                  <div>
                    <Link href={`/portal/projects/${project.id}`} className="text-[15px] font-medium text-tx">
                      {project.name}
                    </Link>
                    <span className="text-[13px] text-fa">
                      {" · "}
                      {project.progress.total > 0
                        ? `${project.progress.done} of ${plural(project.progress.total, "step")} complete`
                        : "Not broken down yet"}
                      {project.endDate ? ` · target ${formatDate(project.endDate)}` : ""}
                    </span>
                  </div>
                  {project.liveUrl ? (
                    <a href={project.liveUrl} target="_blank" rel="noreferrer noopener" className="text-[13px]">
                      Visit project ↗
                    </a>
                  ) : null}
                </div>
                <PortalProgress percent={project.progress.percent} />
                <div className="text-[12.5px] text-mu">{project.progress.percent}% complete</div>
              </div>
            ))
          )}
        </PortalCard>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          <PortalCard className="pb-3">
            <PortalCardHead title="Invoices due" action={<Link href="/portal/invoices">All invoices</Link>} />
            {unpaid.length === 0 ? (
              <PortalEmpty>Nothing due right now.</PortalEmpty>
            ) : (
              unpaid.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/portal/invoices/${invoice.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-ln py-2.5 text-tx hover:text-tx"
                >
                  <span>
                    <span className="block text-[14px] font-medium">{invoice.number}</span>
                    <span className="block text-[12.5px] text-fa">Due {formatDate(invoice.dueDate)}</span>
                  </span>
                  <span className="text-[14px]">{formatMoney(invoice.totals.totalCents)}</span>
                  <PortalPill value={invoice.effectiveStatus} />
                </Link>
              ))
            )}
          </PortalCard>

          <PortalCard className="pb-3">
            <PortalCardHead title="Recent files" action={<Link href="/portal/files">All files</Link>} />
            <PortalFileList files={data.files} mode="compact" emptyText="No files yet." />
          </PortalCard>
        </div>
      </PortalMain>
    </>
  );
}
