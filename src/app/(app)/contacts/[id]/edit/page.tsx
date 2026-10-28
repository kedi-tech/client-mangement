import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { clientScope, viaClient } from "@/server/scope";
import { updateContactAction } from "@/server/actions/contacts";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [contact, clients] = await Promise.all([
    prisma.contact.findFirst({ where: { id, ...viaClient(user) }, include: { client: true } }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!contact) notFound();

  const updateWithId = updateContactAction.bind(null, contact.id);

  return (
    <>
      <PageHeader
        title="Edit contact"
        breadcrumb={
          <BackLink href={`/clients/${contact.clientId}`}>{contact.client.name}</BackLink>
        }
      />
      <ContactForm
        action={updateWithId}
        clients={clients}
        cancelHref={`/clients/${contact.clientId}`}
        values={{
          clientId: contact.clientId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          title: contact.title ?? "",
          isPrimary: contact.isPrimary,
        }}
      />
    </>
  );
}
