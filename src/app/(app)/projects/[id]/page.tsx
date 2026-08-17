import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/confirm-form";
import { TaskRow } from "@/components/task-row";
import {
  Badge,
  Card,
  CardHeader,
  DetailList,
  DetailRow,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { deleteProjectAction } from "@/server/actions/projects";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({ params }: { params: Params }) {
  await requireUser();
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
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

  const doneTasks = project.tasks.filter((task) => task.status === "DONE").length;
  const progress =
    project.tasks.length > 0 ? Math.round((doneTasks / project.tasks.length) * 100) : 0;
  const budgetUsed =
    project.budgetCents > 0 ? Math.min(Math.round((invoicedCents / project.budgetCents) * 100), 999) : 0;

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        breadcrumb={
          <span className="flex flex-wrap items-center gap-1">
            <Link href="/projects" className="hover:text-indigo-600 hover:underline">
              Projects
            </Link>
            <span>/</span>
            <Link href={`/clients/${project.client.id}`} className="hover:text-indigo-600 hover:underline">
              {project.client.name}
            </Link>
          </span>
        }
        actions={
          <>
            <Badge value={project.status} className="self-center" />
            <LinkButton href={`/invoices/new?clientId=${project.clientId}&projectId=${project.id}`} variant="secondary">
              New invoice
            </LinkButton>
            <LinkButton href={`/projects/${project.id}/edit`}>Edit</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Tasks"
              description={`${doneTasks} of ${project.tasks.length} complete`}
              action={
                <Link
                  href={`/tasks?projectId=${project.id}`}
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Manage tasks
                </Link>
              }
            />
            <div className="px-5 pt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{progress}% complete</p>
            </div>
            {project.tasks.length === 0 ? (
              <EmptyState
                title="No tasks yet"
                description="Break the project down so the next step is always visible."
                action={<LinkButton href={`/tasks?projectId=${project.id}`}>Add tasks</LinkButton>}
              />
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {project.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} showClient={false} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Invoices" description={`${formatMoney(invoicedCents)} invoiced`} />
            {invoices.length === 0 ? (
              <EmptyState
                title="No invoices for this project"
                action={
                  <LinkButton href={`/invoices/new?clientId=${project.clientId}&projectId=${project.id}`}>
                    New invoice
                  </LinkButton>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {formatMoney(invoice.totals.totalCents)}
                      </span>
                      <Badge value={invoice.effectiveStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Overview" />
            <DetailList>
              <DetailRow term="Client">
                <Link
                  href={`/clients/${project.client.id}`}
                  className="text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {project.client.name}
                </Link>
              </DetailRow>
              <DetailRow term="Status">
                <Badge value={project.status} />
              </DetailRow>
              <DetailRow term="Budget">{formatMoney(project.budgetCents)}</DetailRow>
              <DetailRow term="Invoiced">{formatMoney(invoicedCents)}</DetailRow>
              <DetailRow term="Start">{formatDate(project.startDate)}</DetailRow>
              <DetailRow term="End">{formatDate(project.endDate)}</DetailRow>
            </DetailList>

            {project.budgetCents > 0 ? (
              <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Budget used
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={
                      budgetUsed > 100
                        ? "h-full rounded-full bg-rose-500"
                        : "h-full rounded-full bg-indigo-500"
                    }
                    style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {budgetUsed}% of {formatMoney(project.budgetCents)}
                </p>
              </div>
            ) : null}

            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <ConfirmForm
                action={deleteProjectAction}
                hidden={{ projectId: project.id }}
                confirmMessage={`Delete ${project.name}? Its tasks will be removed too.`}
              >
                Delete project
              </ConfirmForm>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
