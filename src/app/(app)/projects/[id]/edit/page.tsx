import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { centsToInput, dateToInput } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { updateProjectAction } from "@/server/actions/projects";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [project, clients] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!project) notFound();

  const updateWithId = updateProjectAction.bind(null, project.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${project.name}`}
        breadcrumb={
          <Link href={`/projects/${project.id}`} className="hover:text-indigo-600 hover:underline">
            ← {project.name}
          </Link>
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
          startDate: dateToInput(project.startDate),
          endDate: dateToInput(project.endDate),
        }}
      />
    </div>
  );
}
