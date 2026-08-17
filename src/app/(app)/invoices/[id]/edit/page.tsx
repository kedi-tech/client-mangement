import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { centsToInput, dateToInput } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { updateInvoiceAction } from "@/server/actions/invoices";
import { InvoiceForm } from "../../invoice-form";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [invoice, clients, projects] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  if (!invoice) notFound();

  const updateWithId = updateInvoiceAction.bind(null, invoice.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Edit ${invoice.number}`}
        breadcrumb={
          <Link href={`/invoices/${invoice.id}`} className="hover:text-indigo-600 hover:underline">
            ← {invoice.number}
          </Link>
        }
      />
      <InvoiceForm
        action={updateWithId}
        clients={clients}
        projects={projects}
        submitLabel="Save changes"
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
    </div>
  );
}
