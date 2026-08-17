"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { invoiceSchema, toFieldErrors, type FormState } from "@/lib/validation";
import { logActivity } from "@/server/activity";

/**
 * Line items arrive as parallel arrays (`itemDescription[]`, `itemQuantity[]`,
 * `itemUnitPrice[]`) so the client-side row editor can add and remove rows
 * without renumbering field names. Blank rows are dropped.
 */
function readInvoiceForm(formData: FormData) {
  const descriptions = formData.getAll("itemDescription").map(String);
  const quantities = formData.getAll("itemQuantity").map(String);
  const unitPrices = formData.getAll("itemUnitPrice").map(String);

  const items = descriptions
    .map((description, index) => ({
      description,
      quantity: quantities[index] ?? "1",
      unitPrice: unitPrices[index] ?? "0",
    }))
    .filter((item) => item.description.trim() !== "");

  return invoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    number: formData.get("number"),
    status: formData.get("status"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    taxRate: formData.get("taxRate"),
    notes: formData.get("notes"),
    items,
  });
}

/** The chosen project must belong to the chosen client. */
async function validProjectId(clientId: string, projectId?: string): Promise<string | null> {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({ where: { id: projectId, clientId } });
  return project?.id ?? null;
}

export async function createInvoiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readInvoiceForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const data = parsed.data;
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) return { error: "That client no longer exists." };

  const duplicate = await prisma.invoice.findUnique({ where: { number: data.number } });
  if (duplicate) return { fieldErrors: { number: ["That invoice number is already in use."] } };

  const issueDate = data.issueDate ?? new Date();
  const dueDate = data.dueDate ?? new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (dueDate < issueDate) {
    return { fieldErrors: { dueDate: ["Due date cannot be before the issue date"] } };
  }

  const invoice = await prisma.invoice.create({
    data: {
      number: data.number,
      clientId: client.id,
      projectId: await validProjectId(client.id, data.projectId),
      status: data.status,
      issueDate,
      dueDate,
      paidAt: data.status === "PAID" ? new Date() : null,
      taxRate: data.taxRate,
      notes: data.notes,
      items: {
        create: data.items.map((item, position) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPrice,
          position,
        })),
      },
    },
  });

  await logActivity({
    type: "INVOICE_CREATED",
    message: `Invoice ${invoice.number} was created for ${client.name}`,
    actorId: user.id,
    clientId: client.id,
    entityType: "Invoice",
    entityId: invoice.id,
  });

  revalidatePath("/invoices");
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoiceAction(
  invoiceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = readInvoiceForm(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const data = parsed.data;
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) return { error: "That invoice no longer exists." };

  const duplicate = await prisma.invoice.findFirst({
    where: { number: data.number, id: { not: invoiceId } },
  });
  if (duplicate) return { fieldErrors: { number: ["That invoice number is already in use."] } };

  const issueDate = data.issueDate ?? existing.issueDate;
  const dueDate = data.dueDate ?? existing.dueDate;
  if (dueDate < issueDate) {
    return { fieldErrors: { dueDate: ["Due date cannot be before the issue date"] } };
  }

  // Line items are replaced wholesale — simpler and safe under the cascade.
  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        number: data.number,
        clientId: data.clientId,
        projectId: await validProjectId(data.clientId, data.projectId),
        status: data.status,
        issueDate,
        dueDate,
        paidAt:
          data.status === "PAID" ? (existing.paidAt ?? new Date()) : null,
        taxRate: data.taxRate,
        notes: data.notes,
        items: {
          create: data.items.map((item, position) => ({
            description: item.description,
            quantity: item.quantity,
            unitPriceCents: item.unitPrice,
            position,
          })),
        },
      },
    });
  });

  if (existing.status !== invoice.status) {
    await logActivity({
      type: "INVOICE_STATUS_CHANGED",
      message: `Invoice ${invoice.number} moved from ${existing.status} to ${invoice.status}`,
      actorId: user.id,
      clientId: invoice.clientId,
      entityType: "Invoice",
      entityId: invoice.id,
    });
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/clients/${invoice.clientId}`);
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoiceId}`);
}

/** Status shortcuts from the invoice detail header. */
export async function setInvoiceStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["DRAFT", "SENT", "PAID", "VOID"].includes(status)) return;

  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) return;

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      paidAt: status === "PAID" ? (existing.paidAt ?? new Date()) : null,
    },
  });

  await logActivity({
    type: "INVOICE_STATUS_CHANGED",
    message: `Invoice ${invoice.number} was marked ${status.toLowerCase()}`,
    actorId: user.id,
    clientId: invoice.clientId,
    entityType: "Invoice",
    entityId: invoice.id,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/clients/${invoice.clientId}`);
  revalidatePath("/dashboard");
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) redirect("/invoices");

  await prisma.invoice.delete({ where: { id: invoiceId } });

  await logActivity({
    type: "INVOICE_DELETED",
    message: `Invoice ${invoice.number} was deleted`,
    actorId: user.id,
    clientId: invoice.clientId,
    entityType: "Invoice",
    entityId: invoiceId,
  });

  revalidatePath("/invoices");
  revalidatePath(`/clients/${invoice.clientId}`);
  revalidatePath("/dashboard");
  redirect("/invoices");
}
