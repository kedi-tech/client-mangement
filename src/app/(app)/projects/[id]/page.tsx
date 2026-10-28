import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/confirm-form";
import { TaskRow } from "@/components/task-row";
import {
  Badge,
  Card,
  CardHeader,
  Crumbs,
  DetailList,
  DetailRow,
  EmptyRow,
  LinkButton,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals } from "@/lib/invoice";
import { projectProgress } from "@/lib/progress";
import { requireUser } from "@/lib/session";
import { viaClient } from "@/server/scope";
import { deleteProjectAction } from "@/server/actions/projects";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const project = await prisma.project.findFirst({ where: { id, ...viaClient(user) }, select: { name: true } });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, ...viaClient(user) },
    include: {
      client: { select: { id: true, name: true, status: true } },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
      invoices: { include: { items: true }, orderBy: { issueDate: "desc" } },
    },
  });

  if (!project) notFound();

  const invoices = project.invoices.map((invoice) => ({
    ...invoice,
    effectiveStatus: effectiveInvoiceStatus(invoice),
    totals: invoiceTotals(invoice.items, invoice.taxRate),
  }));

  const invoicedCents = invoices
    .filter((i) => i.effectiveStatus !== "VOID" && i.effectiveStatus !== "DRAFT")
    .reduce((sum, i) => sum + i.totals.totalCents, 0);

  const progress = projectProgress(project.tasks);
  const budgetUsed =
    project.budgetCents > 0 ? Math.min(Math.round((invoicedCents / project.budgetCents) * 100), 999) : 0;
  const budgetColor = budgetUsed > 100 ? "var(--red)" : "var(--ac)";

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        breadcrumb={
          <Crumbs
            items={[
              { href: "/projects", label: "Projects" },
              { href: `/clients/${project.client.id}`, label: project.client.name },
            ]}
          />
        }
        actions={
          <>
            {project.liveUrl ? (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-[4px] border border-inpb bg-pn px-3 py-1.5 whitespace-nowrap text-tx hover:bg-hov hover:text-tx"
              >
                Visit project ↗
              </a>
            ) : null}
            <LinkButton
              href={`/invoices/new?clientId=${project.client.id}&projectId=${project.id}`}
              variant="secondary"
            >
              New invoice
            </LinkButton>
            <LinkButton href={`/projects/${project.id}/edit`}>Edit</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="Tasks"
              description={`${progress.done} of ${progress.total} done`}
              action={<Link href={`/tasks?projectId=${project.id}`}>Manage tasks</Link>}
            />
            {project.tasks.length > 0 ? (
              <div className="flex items-center gap-3 border-b border-l2 px-3.5 py-3">
                <ProgressBar percent={progress.percent} />
                <span className="font-mono text-[12px] whitespace-nowrap text-mu">
                  {progress.percent}% complete
                </span>
              </div>
            ) : null}
            {project.tasks.length === 0 ? (
              <div className="px-3.5 py-[22px] text-[13px] text-mu">
                Break the project down so the next step is always visible.
              </div>
            ) : (
              project.tasks.map((task) => <TaskRow key={task.id} task={task} variant="project" />)
            )}
          </Card>

          <Card>
            <CardHeader title="Invoices" />
            {invoices.length === 0 ? (
              <EmptyRow>No invoices for this project yet.</EmptyRow>
            ) : (
              invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-l2 px-3.5 py-[9px] text-tx last:border-b-0 hover:bg-hov hover:text-tx"
                >
                  <span>
                    <span className="block font-mono text-[12.5px]">{invoice.number}</span>
                    <span className="block text-[12px] text-fa">Due {formatDate(invoice.dueDate)}</span>
                  </span>
                  <span className="font-mono text-[12.5px]">{formatMoney(invoice.totals.totalCents)}</span>
                  <Badge value={invoice.effectiveStatus} />
                </Link>
              ))
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Details" />
          <DetailList className="pb-0">
            <DetailRow term="Client">
              <Link href={`/clients/${project.client.id}`}>{project.client.name}</Link>
            </DetailRow>
            <DetailRow term="Status">
              <Badge value={project.status} />
            </DetailRow>
            <DetailRow term="Budget">
              <span className="font-mono">{formatMoney(project.budgetCents)}</span>
            </DetailRow>
            <DetailRow term="Invoiced">
              <span className="font-mono">{formatMoney(invoicedCents)}</span>
            </DetailRow>
            <DetailRow term="Project link">
              {project.liveUrl ? (
                <a href={project.liveUrl} target="_blank" rel="noreferrer noopener">
                  {project.liveUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                <span className="text-fa">Not set</span>
              )}
            </DetailRow>
            <DetailRow term="Start">{formatDate(project.startDate)}</DetailRow>
            <DetailRow term="End">{formatDate(project.endDate)}</DetailRow>
          </DetailList>
          <div className="flex flex-col items-start px-3.5 pb-3.5">
            {project.budgetCents > 0 ? (
              <div className="mt-3 flex w-full flex-col gap-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-mu">Budget used</span>
                  <span className="font-mono" style={{ color: budgetColor }}>
                    {budgetUsed}%
                  </span>
                </div>
                <ProgressBar percent={budgetUsed} color={budgetColor} />
              </div>
            ) : null}
            <ConfirmForm
              action={deleteProjectAction}
              hidden={{ projectId: project.id }}
              confirmMessage={`Delete ${project.name}? Its tasks will be removed too.`}
              className="mt-3.5"
            >
              Delete project
            </ConfirmForm>
          </div>
        </Card>
      </div>
    </>
  );
}
