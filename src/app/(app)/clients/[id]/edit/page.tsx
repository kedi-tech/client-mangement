import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { STAFF_ONLY } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { updateClientAction } from "@/server/actions/clients";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [client, owners] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: STAFF_ONLY,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!client) notFound();

  const updateWithId = updateClientAction.bind(null, client.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Edit ${client.name}`}
        breadcrumb={
          <Link href={`/clients/${client.id}`} className="hover:text-indigo-600 hover:underline">
            ← {client.name}
          </Link>
        }
      />
      <ClientForm
        action={updateWithId}
        owners={owners}
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
          ownerId: client.ownerId ?? "",
        }}
      />
    </div>
  );
}
