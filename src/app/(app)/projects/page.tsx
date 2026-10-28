import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar, FilterSelect, Pagination } from "@/components/filters";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import {
  Badge,
  Card,
  EmptyBox,
  GridHead,
  GridRow,
  GridTable,
  LinkButton,
  PageHeader,
  Stack,
} from "@/components/ui";
import { PROJECT_STATUSES, label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { like } from "@/lib/search";
import { requireUser } from "@/lib/session";
import { deleteProjectAction } from "@/server/actions/projects";
import { clientScope, viaClient } from "@/server/scope";

export const metadata: Metadata = { title: "Projects" };

const PAGE_SIZE = 15;
const COLS = "minmax(220px,2fr) minmax(140px,1fr) 100px 100px 60px 180px 190px";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const clientId = params.clientId ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...viaClient(user),
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [{ name: like(q) }, { description: like(q) }, { client: { name: like(q) } }],
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
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status || clientId);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every piece of work across your clients."
        actions={<LinkButton href="/projects/new">New project</LinkButton>}
      />

      <FilterBar>
        <SearchInput placeholder="Search name, description, client" />
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
      </FilterBar>

      {projects.length === 0 ? (
        filtered ? (
          <EmptyBox
            title="No projects match those filters"
            action={
              <LinkButton href="/projects" variant="secondary">
                Clear filters
              </LinkButton>
            }
          />
        ) : (
          <EmptyBox
            title="No projects yet"
            action={
              <LinkButton href="/projects/new" variant="secondary">
                New project
              </LinkButton>
            }
          />
        )
      ) : (
        <>
          <Card>
            <GridTable minWidth={1020}>
              <GridHead cols={COLS}>
                <span>Project</span>
                <span>Client</span>
                <span>Status</span>
                <span className="text-right">Budget</span>
                <span className="text-right">Tasks</span>
                <span>Timeline</span>
                <span className="text-right">Actions</span>
              </GridHead>
              {projects.map((project) => (
                <GridRow key={project.id} cols={COLS}>
                  <Stack primary={<Link href={`/projects/${project.id}`}>{project.name}</Link>} secondary={project.description ?? ""} />
                  <span className="truncate text-mu">{project.client.name}</span>
                  <span>
                    <Badge value={project.status} />
                  </span>
                  <span className="text-right font-mono text-[12.5px]">{formatMoney(project.budgetCents)}</span>
                  <span className="text-right font-mono text-[12.5px]">{project._count.tasks}</span>
                  <span className="text-[12px] text-mu">
                    {project.startDate || project.endDate
                      ? `${project.startDate ? formatDate(project.startDate) : "—"} → ${
                          project.endDate ? formatDate(project.endDate) : "open"
                        }`
                      : "—"}
                  </span>
                  <RowActions
                    viewHref={`/projects/${project.id}`}
                    editHref={`/projects/${project.id}/edit`}
                    remove={{
                      action: deleteProjectAction,
                      hidden: { projectId: project.id },
                      confirmMessage: `Delete ${project.name}? Its tasks will be removed too.`,
                    }}
                  />
                </GridRow>
              ))}
            </GridTable>
          </Card>
          <Pagination page={page} pageCount={pageCount} total={total} noun="project" searchParams={params} />
        </>
      )}
    </>
  );
}
