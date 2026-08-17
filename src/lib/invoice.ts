import type { InvoiceStatus } from "@/lib/constants";

export type InvoiceLine = {
  quantity: number;
  unitPriceCents: number;
};

export type InvoiceTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

/** Totals for an invoice. Rounded per-line so the sum matches the printed lines. */
export function invoiceTotals(items: InvoiceLine[], taxRate: number): InvoiceTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0,
  );
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function lineTotalCents(item: InvoiceLine): number {
  return Math.round(item.quantity * item.unitPriceCents);
}

/**
 * An invoice that was sent and has passed its due date reads as overdue even if
 * nobody has re-saved the record. Stored status still wins for terminal states.
 */
export function effectiveInvoiceStatus(invoice: {
  status: string;
  dueDate: Date | string;
  paidAt?: Date | null;
}): InvoiceStatus {
  if (invoice.status === "PAID" || invoice.status === "VOID" || invoice.status === "DRAFT") {
    return invoice.status as InvoiceStatus;
  }
  const due = typeof invoice.dueDate === "string" ? new Date(invoice.dueDate) : invoice.dueDate;
  if (due.getTime() < Date.now()) return "OVERDUE";
  return invoice.status as InvoiceStatus;
}

/** Counts toward money owed: everything sent or overdue but not yet paid. */
export function isOutstanding(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "OVERDUE";
}

/** Next sequential invoice number, e.g. INV-1009 after INV-1008. */
export function nextInvoiceNumber(latest?: string | null): string {
  const match = latest?.match(/(\d+)\s*$/);
  const next = match ? Number(match[1]) + 1 : 1001;
  return `INV-${next}`;
}
