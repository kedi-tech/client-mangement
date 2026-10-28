import type { Metadata } from "next";

import { BackLink, EmptyBox, LinkButton, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { clientScope } from "@/server/scope";
import { emptyProject } from "@/lib/form-defaults";
import { createProjectAction } from "@/server/actions/projects";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const clients = await prisma.client.findMany({
    where: clientScope(user),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="New project" breadcrumb={<BackLink href="/projects">Projects</BackLink>} />
        <EmptyBox
          title="Add a client first"
          description="Every project belongs to a client."
          action={<LinkButton href="/clients/new">New client</LinkButton>}
          className="max-w-[760px]"
        />
      </>
    );
  }

  const preselected = params.clientId && clients.some((c) => c.id === params.clientId)
    ? params.clientId
    : clients[0].id;

  return (
    <>
      <PageHeader
        title="New project"
        breadcrumb={
          <BackLink href={"/projects"}>Projects</BackLink>
        }
      />
      <ProjectForm
        action={createProjectAction}
        values={{ ...emptyProject, clientId: preselected }}
        clients={clients}
        submitLabel="Create project"
        cancelHref="/projects"
      />
    </>
  );
}
