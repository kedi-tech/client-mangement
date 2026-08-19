import "server-only";

import {
  ACTIVITY_CATEGORIES,
  STAFF_ROLES,
  type ActivityCategory,
} from "@/lib/constants";
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

/* -------------------------------------------------------------- oversight */

export type OversightFilters = {
  /** Restrict to one actor, or all staff when null. */
  actorId: string | null;
  category: ActivityCategory | null;
  /** Only activity at or after this instant. */
  since: Date | null;
  page: number;
  pageSize: number;
};

/**
 * Everything the super admin's oversight page renders: who is on staff, how
 * busy each has been in the window, and the matching slice of the activity feed.
 *
 * Read-only by construction — it is a window onto the append-only Activity log,
 * which every server action already writes to.
 */
export async function getOversightData(filters: OversightFilters) {
  const { actorId, category, since, page, pageSize } = filters;

  const where = {
    // Portal uploads are logged too; oversight is about the team, so activity
    // with no actor (or a client actor) is excluded by the staff join below.
    ...(actorId ? { actorId } : {}),
    ...(category ? { type: { in: [...ACTIVITY_CATEGORIES[category].types] } } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [staff, total, entries, byActor, accessCount, deletionCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
    }),
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, name: true } },
      },
    }),
    // Per-person totals for the same window, so the roster and the feed agree.
    prisma.activity.groupBy({
      by: ["actorId"],
      where: { ...(since ? { createdAt: { gte: since } } : {}) },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.activity.count({
      where: {
        ...(since ? { createdAt: { gte: since } } : {}),
        type: { in: [...ACTIVITY_CATEGORIES.ACCESS.types] },
      },
    }),
    prisma.activity.count({
      where: {
        ...(since ? { createdAt: { gte: since } } : {}),
        type: { in: [...ACTIVITY_CATEGORIES.DELETION.types] },
      },
    }),
  ]);

  const counts = new Map(
    byActor.map((row) => [row.actorId, { total: row._count._all, last: row._max.createdAt }]),
  );

  const roster = staff.map((member) => ({
    ...member,
    actionCount: counts.get(member.id)?.total ?? 0,
    lastActionAt: counts.get(member.id)?.last ?? null,
  }));

  return {
    roster,
    entries,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    totals: {
      // Activity in the window across everyone, not just the filtered slice.
      actions: byActor.reduce((sum, row) => sum + row._count._all, 0),
      accessChanges: accessCount,
      deletions: deletionCount,
      activeStaff: roster.filter((member) => member.actionCount > 0).length,
    },
  };
}
