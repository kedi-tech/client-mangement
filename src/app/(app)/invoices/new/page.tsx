import type { Metadata } from "next";

import { BackLink, EmptyBox, LinkButton, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateToInput } from "@/lib/format";
import { nextInvoiceNumber } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { clientScope, viaClient } from "@/server/scope";
import { emptyLine } from "@/lib/form-defaults";
import { createInvoiceAction } from "@/server/actions/invoices";
import { InvoiceForm } from "../invoice-form";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [clients, projects, latest] = await Promise.all([
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: viaClient(user),
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    prisma.invoice.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
  ]);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="New invoice" breadcrumb={<BackLink href="/invoices">Invoices</BackLink>} />
        <EmptyBox
          title="Add a client first"
          description="Invoices are billed to a client."
          action={<LinkButton href="/clients/new">New client</LinkButton>}
          className="max-w-[760px]"
        />
      </>
    );
  }

  const clientId =
    params.clientId && clients.some((c) => c.id === params.clientId)
      ? params.clientId
      : clients[0].id;
  const projectId =
    params.projectId && projects.some((p) => p.id === params.projectId && p.clientId === clientId)
      ? params.projectId
      : "";

  const today = new Date();
  const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <>
      <PageHeader
        title="New invoice"
        breadcrumb={
          <BackLink href={"/invoices"}>Invoices</BackLink>
        }
      />
      <InvoiceForm
        action={createInvoiceAction}
        clients={clients}
        projects={projects}
        submitLabel="Create invoice"
        cancelHref="/invoices"
        values={{
          clientId,
          projectId,
          number: nextInvoiceNumber(latest?.number),
          status: "DRAFT",
          issueDate: dateToInput(today),
          dueDate: dateToInput(dueDate),
          taxRate: "0",
          notes: "",
          items: [{ ...emptyLine }],
        }}
      />
    </>
  );
}
