import "server-only";

import { prisma } from "@/lib/db";
import { effectiveInvoiceStatus, invoiceTotals, isOutstanding } from "@/lib/invoice";
import { projectProgress } from "@/lib/progress";

/** Every invoice with its lines, so totals can be computed in one place. */
export async function invoicesWithTotals(where: Record<string, unknown> = {}) {
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      items: { orderBy: { position: "asc" } },
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    orderBy: { issueDate: "desc" },
  });

  return invoices.map((invoice) => ({
    ...invoice,
    effectiveStatus: effectiveInvoiceStatus(invoice),
    totals: invoiceTotals(invoice.items, invoice.taxRate),
  }));
}

export type InvoiceWithTotals = Awaited<ReturnType<typeof invoicesWithTotals>>[number];

export async function getDashboardData() {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    clientCounts,
    projectCounts,
    invoices,
    upcomingTasks,
    overdueTaskCount,
    recentClients,
    activity,
  ] = await Promise.all([
    prisma.client.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.project.groupBy({ by: ["status"], _count: { _all: true } }),
    invoicesWithTotals(),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        client: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where: { status: { not: "DONE" }, dueDate: { lt: now } } }),
    prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        owner: { select: { name: true } },
        _count: { select: { projects: true, contacts: true } },
      },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        actor: { select: { name: true } },
        client: { select: { id: true, name: true } },
      },
    }),
  ]);

  const countFor = (rows: { status: string; _count: { _all: number } }[], status: string) =>
    rows.find((row) => row.status === status)?._count._all ?? 0;

  const collectedCents = invoices
    .filter((invoice) => invoice.effectiveStatus === "PAID")
    .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0);

  const outstandingCents = invoices
    .filter((invoice) => isOutstanding(invoice.effectiveStatus))
    .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0);

  const overdueInvoices = invoices.filter((invoice) => invoice.effectiveStatus === "OVERDUE");

  // Trailing six months of collected revenue, oldest first.
  const revenueByMonth: { label: string; cents: number }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
    const cents = invoices
      .filter(
        (invoice) =>
          invoice.effectiveStatus === "PAID" &&
          invoice.paidAt !== null &&
          invoice.paidAt >= start &&
          invoice.paidAt < end,
      )
      .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0);
    revenueByMonth.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      cents,
    });
  }

  return {
    stats: {
      totalClients: clientCounts.reduce((sum, row) => sum + row._count._all, 0),
      activeClients: countFor(clientCounts, "ACTIVE"),
      leads: countFor(clientCounts, "LEAD"),
      activeProjects: countFor(projectCounts, "ACTIVE"),
      planningProjects: countFor(projectCounts, "PLANNING"),
      collectedCents,
      outstandingCents,
      overdueCount: overdueInvoices.length,
      overdueCents: overdueInvoices.reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
      openTasks: upcomingTasks.length,
      overdueTaskCount,
    },
    dueSoonWindow: soon,
    upcomingTasks,
    recentClients,
    activity,
    attentionInvoices: invoices
      .filter((invoice) => isOutstanding(invoice.effectiveStatus))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5),
    revenueByMonth,
  };
}

/** Per-client rollups used by the clients table and the reports page. */
export async function getClientRollups() {
  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { contacts: true, projects: true, invoices: true } },
      },
    }),
    invoicesWithTotals(),
  ]);

  return clients.map((client) => {
    const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
    return {
      ...client,
      billedCents: clientInvoices
        .filter((invoice) => invoice.effectiveStatus !== "VOID" && invoice.effectiveStatus !== "DRAFT")
        .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
      paidCents: clientInvoices
        .filter((invoice) => invoice.effectiveStatus === "PAID")
        .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
      outstandingCents: clientInvoices
        .filter((invoice) => isOutstanding(invoice.effectiveStatus))
        .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
    };
  });
}

/* --------------------------------------------------------------- portal reads
 *
 * Every function below takes the client id from the session and filters on it,
 * so a portal user can only ever read their own records. Draft invoices are
 * withheld: they are not yet issued.
 */

const PORTAL_HIDDEN_INVOICE_STATUSES = ["DRAFT"];

export async function getPortalOverview(clientId: string) {
  const [client, projects, invoices, files] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      include: { owner: { select: { name: true, email: true } } },
    }),
    prisma.project.findMany({
      where: { clientId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { tasks: { select: { id: true, status: true } } },
    }),
    invoicesWithTotals({
      clientId,
      status: { notIn: PORTAL_HIDDEN_INVOICE_STATUSES },
    }),
    prisma.attachment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        uploader: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  const outstandingCents = invoices
    .filter((invoice) => isOutstanding(invoice.effectiveStatus))
    .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0);
  const overdue = invoices.filter((invoice) => invoice.effectiveStatus === "OVERDUE");

  return {
    client,
    projects: projects.map((project) => ({
      ...project,
      progress: projectProgress(project.tasks),
    })),
    invoices,
    files,
    totals: {
      outstandingCents,
      overdueCents: overdue.reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
      overdueCount: overdue.length,
      paidCents: invoices
        .filter((invoice) => invoice.effectiveStatus === "PAID")
        .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
      activeProjects: projects.filter((project) => project.status === "ACTIVE").length,
    },
  };
}

/** One project, or null when it does not belong to this client. */
export async function getPortalProject(clientId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, clientId },
    include: {
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        select: { id: true, title: true, status: true, dueDate: true },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { uploader: { select: { name: true } } },
      },
    },
  });
  if (!project) return null;

  const invoices = await invoicesWithTotals({
    clientId,
    projectId: project.id,
    status: { notIn: PORTAL_HIDDEN_INVOICE_STATUSES },
  });

  return { ...project, progress: projectProgress(project.tasks), invoices };
}

/** A single invoice for the portal, scoped to the client and never a draft. */
export async function getPortalInvoice(clientId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId,
      status: { notIn: PORTAL_HIDDEN_INVOICE_STATUSES },
    },
    include: {
      items: { orderBy: { position: "asc" } },
      client: true,
      project: { select: { id: true, name: true } },
    },
  });
  if (!invoice) return null;

  return {
    ...invoice,
    effectiveStatus: effectiveInvoiceStatus(invoice),
    totals: invoiceTotals(invoice.items, invoice.taxRate),
  };
}
