import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { centsToInput, dateToInput } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { clientScope, viaClient } from "@/server/scope";
import { updateProjectAction } from "@/server/actions/projects";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [project, clients] = await Promise.all([
    prisma.project.findFirst({ where: { id, ...viaClient(user) } }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!project) notFound();

  const updateWithId = updateProjectAction.bind(null, project.id);

  return (
    <>
      <PageHeader
        title={`Edit ${project.name}`}
        breadcrumb={
          <BackLink href={`/projects/${project.id}`}>{project.name}</BackLink>
        }
      />
      <ProjectForm
        action={updateWithId}
        clients={clients}
        submitLabel="Save changes"
        cancelHref={`/projects/${project.id}`}
        values={{
          clientId: project.clientId,
          name: project.name,
          description: project.description ?? "",
          status: project.status,
          budget: centsToInput(project.budgetCents),
          liveUrl: project.liveUrl ?? "",
          startDate: dateToInput(project.startDate),
          endDate: dateToInput(project.endDate),
        }}
      />
    </>
  );
}
