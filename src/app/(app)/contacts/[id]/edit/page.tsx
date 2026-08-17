import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { updateContactAction } from "@/server/actions/contacts";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [contact, clients] = await Promise.all([
    prisma.contact.findUnique({ where: { id }, include: { client: true } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!contact) notFound();

  const updateWithId = updateContactAction.bind(null, contact.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        description={`Contact at ${contact.client.name}`}
        breadcrumb={
          <Link
            href={`/clients/${contact.clientId}`}
            className="hover:text-indigo-600 hover:underline"
          >
            ← {contact.client.name}
          </Link>
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
    </div>
  );
}
