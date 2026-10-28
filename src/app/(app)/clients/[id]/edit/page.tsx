import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { clientScope } from "@/server/scope";
import { updateClientAction } from "@/server/actions/clients";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const client = await prisma.client.findFirst({ where: { id, ...clientScope(user) } });

  if (!client) notFound();

  const updateWithId = updateClientAction.bind(null, client.id);

  return (
    <>
      <PageHeader
        title={`Edit ${client.name}`}
        breadcrumb={
          <BackLink href={`/clients/${client.id}`}>{client.name}</BackLink>
        }
      />
      <ClientForm
        action={updateWithId}
        submitLabel="Save changes"
        cancelHref={`/clients/${client.id}`}
        values={{
          name: client.name,
          company: client.company ?? "",
          email: client.email ?? "",
          phone: client.phone ?? "",
          website: client.website ?? "",
          industry: client.industry ?? "",
          status: client.status,
          addressLine: client.addressLine ?? "",
          city: client.city ?? "",
          state: client.state ?? "",
          postalCode: client.postalCode ?? "",
          country: client.country ?? "",
          notes: client.notes ?? "",
        }}
      />
    </>
  );
}
