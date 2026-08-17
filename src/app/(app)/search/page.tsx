import type { Metadata } from "next";
import Link from "next/link";

import { SearchInput } from "@/components/search-input";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals } from "@/lib/invoice";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Search" };

const LIMIT = 8;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [clients, contacts, projects, tasks, invoices] = q
    ? await Promise.all([
        prisma.client.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { company: { contains: q } },
              { email: { contains: q } },
              { industry: { contains: q } },
            ],
          },
          take: LIMIT,
        }),
        prisma.contact.findMany({
          where: {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { title: { contains: q } },
            ],
          },
          take: LIMIT,
          include: { client: { select: { id: true, name: true } } },
        }),
        prisma.project.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { client: { name: { contains: q } } },
            ],
          },
          take: LIMIT,
          include: { client: { select: { id: true, name: true } } },
        }),
        prisma.task.findMany({
          where: {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { client: { name: { contains: q } } },
            ],
          },
          take: LIMIT,
          include: { client: { select: { id: true, name: true } } },
        }),
        prisma.invoice.findMany({
          where: {
            OR: [
              { number: { contains: q } },
              { notes: { contains: q } },
              { client: { name: { contains: q } } },
            ],
          },
          take: LIMIT,
          include: { items: true, client: { select: { id: true, name: true } } },
        }),
      ])
    : [[], [], [], [], []];

  const totalResults =
    clients.length + contacts.length + projects.length + tasks.length + invoices.length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Search"
        description="Look across clients, contacts, projects, tasks and invoices at once."
      />

      <div className="mb-6">
        <SearchInput placeholder="Search everything…" basePath="/search" />
      </div>

      {!q ? (
        <Card>
          <EmptyState
            title="Start typing"
            description="Results appear as you type — try a client name, an invoice number, or a person."
          />
        </Card>
      ) : totalResults === 0 ? (
        <Card>
          <EmptyState title={`No results for "${q}"`} description="Try a different or shorter term." />
        </Card>
      ) : (
        <div className="space-y-6">
          {clients.length > 0 ? (
            <Card>
              <CardHeader title="Clients" description={`${clients.length} matches`} />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {clients.map((client) => (
                  <li key={client.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {client.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {[client.industry, client.email].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <Badge value={client.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {contacts.length > 0 ? (
            <Card>
              <CardHeader title="Contacts" description={`${contacts.length} matches`} />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((contact) => (
                  <li key={contact.id} className="px-5 py-3">
                    <Link
                      href={`/clients/${contact.client.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {[contact.title, contact.client.name, contact.email]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {projects.length > 0 ? (
            <Card>
              <CardHeader title="Projects" description={`${projects.length} matches`} />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {project.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {project.client.name} · {formatMoney(project.budgetCents)}
                      </p>
                    </div>
                    <Badge value={project.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {tasks.length > 0 ? (
            <Card>
              <CardHeader title="Tasks" description={`${tasks.length} matches`} />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/tasks/${task.id}/edit`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {task.title}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {[task.client?.name, task.dueDate ? `due ${formatDate(task.dueDate)}` : null]
                          .filter(Boolean)
                          .join(" · ") || "No client"}
                      </p>
                    </div>
                    <Badge value={task.status} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {invoices.length > 0 ? (
            <Card>
              <CardHeader title="Invoices" description={`${invoices.length} matches`} />
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
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {invoice.client.name} ·{" "}
                        {formatMoney(invoiceTotals(invoice.items, invoice.taxRate).totalCents)}
                      </p>
                    </div>
                    <Badge value={effectiveInvoiceStatus(invoice)} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
