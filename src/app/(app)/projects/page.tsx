import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect, Pagination } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { PROJECT_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { like } from "@/lib/search";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Projects" };

const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const clientId = params.clientId ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { name: like(q) },
            { description: like(q) },
            { client: { name: like(q) } },
          ],
        }
      : {}),
  };

  const [total, projects, clients] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Projects"
        description="Engagements in flight, their budgets and timelines."
        actions={<LinkButton href="/projects/new">New project</LinkButton>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search projects…" />
          </div>
          <FilterSelect
            name="status"
            label="Status"
            allLabel="Any status"
            options={PROJECT_STATUSES.map((value) => ({ value, label: label(value) }))}
          />
          <FilterSelect
            name="clientId"
            label="Client"
            allLabel="All clients"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
          />
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description="Projects group the work you do for a client."
            action={<LinkButton href="/projects/new">New project</LinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Budget</Th>
                  <Th className="text-right">Tasks</Th>
                  <Th>Timeline</Th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <Td>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {project.name}
                      </Link>
                      {project.description ? (
                        <p className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                          {project.description}
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <Link
                        href={`/clients/${project.client.id}`}
                        className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                      >
                        {project.client.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge value={project.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{formatMoney(project.budgetCents)}</Td>
                    <Td className="text-right tabular-nums">{project._count.tasks}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {project.startDate ? formatDate(project.startDate) : "—"}
                      {" → "}
                      {project.endDate ? formatDate(project.endDate) : "open"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} total={total} searchParams={params} />
          </>
        )}
      </Card>
    </>
  );
}
