import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, Card, LinkButton, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { emptyProject } from "@/lib/form-defaults";
import { createProjectAction } from "@/server/actions/projects";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (clients.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="New project" />
        <Card>
          <EmptyState
            title="Add a client first"
            description="Projects belong to a client, so create one before starting a project."
            action={<LinkButton href="/clients/new">New client</LinkButton>}
          />
        </Card>
      </div>
    );
  }

  const preselected = params.clientId && clients.some((c) => c.id === params.clientId)
    ? params.clientId
    : clients[0].id;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New project"
        description="Scope, budget and timeline for a piece of client work."
        breadcrumb={
          <Link href="/projects" className="hover:text-indigo-600 hover:underline">
            ← Projects
          </Link>
        }
      />
      <ProjectForm
        action={createProjectAction}
        values={{ ...emptyProject, clientId: preselected }}
        clients={clients}
        submitLabel="Create project"
        cancelHref="/projects"
      />
    </div>
  );
}
