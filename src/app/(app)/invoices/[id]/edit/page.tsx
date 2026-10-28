import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { centsToInput, dateToInput } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { clientScope, viaClient } from "@/server/scope";
import { updateInvoiceAction } from "@/server/actions/invoices";
import { InvoiceForm } from "../../invoice-form";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [invoice, clients, projects] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, ...viaClient(user) },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: viaClient(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  if (!invoice) notFound();

  const updateWithId = updateInvoiceAction.bind(null, invoice.id);

  return (
    <>
      <PageHeader
        title={`Edit ${invoice.number}`}
        breadcrumb={
          <BackLink href={`/invoices/${invoice.id}`}>{invoice.number}</BackLink>
        }
      />
      <InvoiceForm
        action={updateWithId}
        clients={clients}
        projects={projects}
        submitLabel="Save invoice"
        cancelHref={`/invoices/${invoice.id}`}
        values={{
          clientId: invoice.clientId,
          projectId: invoice.projectId ?? "",
          number: invoice.number,
          status: invoice.status,
          issueDate: dateToInput(invoice.issueDate),
          dueDate: dateToInput(invoice.dueDate),
          taxRate: String(invoice.taxRate),
          notes: invoice.notes ?? "",
          items: invoice.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: centsToInput(item.unitPriceCents),
          })),
        }}
      />
    </>
  );
}
