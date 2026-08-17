import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/confirm-form";
import { FileList } from "@/components/file-list";
import { TaskRow } from "@/components/task-row";
import { UploadForm } from "@/components/upload-form";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  DetailList,
  DetailRow,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, initials, relativeTime } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals, isOutstanding } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { deleteClientAction, deleteNoteAction } from "@/server/actions/clients";
import { deleteContactAction } from "@/server/actions/contacts";
import { uploadStaffFileAction } from "@/server/actions/files";
import { revokePortalUserAction } from "@/server/actions/portal-access";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import { AddContactForm, AddNoteForm } from "./client-panels";
import { CreatePortalUser, ResetPortalPassword } from "./portal-access";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  return { title: client?.name ?? "Client" };
}

export default async function ClientDetailPage({ params }: { params: Params }) {
  await requireUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
      projects: { orderBy: { createdAt: "desc" } },
      invoices: { include: { items: true }, orderBy: { issueDate: "desc" } },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
      noteLog: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { actor: { select: { name: true } } },
      },
      portalUsers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: {
          uploader: { select: { name: true } },
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!client) notFound();

  const invoices = client.invoices.map((invoice) => ({
    ...invoice,
    effectiveStatus: effectiveInvoiceStatus(invoice),
    totals: invoiceTotals(invoice.items, invoice.taxRate),
  }));

  const billedCents = invoices
    .filter((i) => i.effectiveStatus !== "DRAFT" && i.effectiveStatus !== "VOID")
    .reduce((sum, i) => sum + i.totals.totalCents, 0);
  const paidCents = invoices
    .filter((i) => i.effectiveStatus === "PAID")
    .reduce((sum, i) => sum + i.totals.totalCents, 0);
  const outstandingCents = invoices
    .filter((i) => isOutstanding(i.effectiveStatus))
    .reduce((sum, i) => sum + i.totals.totalCents, 0);

  const openTasks = client.tasks.filter((task) => task.status !== "DONE");
  const address = [
    client.addressLine,
    [client.city, client.state].filter(Boolean).join(", "),
    [client.postalCode, client.country].filter(Boolean).join(" "),
  ]
    .filter((line) => line && line.trim() !== "")
    .join("\n");

  return (
    <>
      <PageHeader
        title={client.name}
        description={[client.company, client.industry].filter(Boolean).join(" · ") || undefined}
        breadcrumb={
          <Link href="/clients" className="hover:text-indigo-600 hover:underline">
            ← Clients
          </Link>
        }
        actions={
          <>
            <Badge value={client.status} className="self-center" />
            <LinkButton href={`/projects/new?clientId=${client.id}`} variant="secondary">
              New project
            </LinkButton>
            <LinkButton href={`/invoices/new?clientId=${client.id}`} variant="secondary">
              New invoice
            </LinkButton>
            <LinkButton href={`/clients/${client.id}/edit`}>Edit</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Billed to date</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
            {formatMoney(billedCents)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Collected</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatMoney(paidCents)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Outstanding</p>
          <p
            className={
              outstandingCents > 0
                ? "mt-1 text-xl font-semibold text-rose-600 dark:text-rose-400"
                : "mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50"
            }
          >
            {formatMoney(outstandingCents)}
          </p>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Contacts */}
          <Card>
            <CardHeader
              title="Contacts"
              description={`${client.contacts.length} on file`}
              action={<AddContactForm clientId={client.id} />}
            />
            {client.contacts.length === 0 ? (
              <EmptyState title="No contacts yet" description="Add the people you work with here." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {client.contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar text={initials(`${contact.firstName} ${contact.lastName}`)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {contact.firstName} {contact.lastName}
                        {contact.isPrimary ? (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {[contact.title, contact.email, contact.phone].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={`/contacts/${contact.id}/edit`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        Edit
                      </Link>
                      <ConfirmForm
                        action={deleteContactAction}
                        hidden={{ contactId: contact.id }}
                        confirmMessage={`Delete ${contact.firstName} ${contact.lastName}?`}
                        variant="subtle"
                      >
                        Delete
                      </ConfirmForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader
              title="Projects"
              description={`${client.projects.length} total`}
              action={
                <Link
                  href={`/projects/new?clientId=${client.id}`}
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  New project
                </Link>
              }
            />
            {client.projects.length === 0 ? (
              <EmptyState title="No projects yet" description="Track engagements and their budgets here." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {client.projects.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {project.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {formatMoney(project.budgetCents)} budget
                        {project.endDate ? ` · ends ${formatDate(project.endDate)}` : ""}
                      </p>
                    </div>
                    <Badge value={project.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader
              title="Invoices"
              description={`${invoices.length} total`}
              action={
                <Link
                  href={`/invoices/new?clientId=${client.id}`}
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  New invoice
                </Link>
              }
            />
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100"
                      >
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                        {formatMoney(invoice.totals.totalCents)}
                      </span>
                      <Badge value={invoice.effectiveStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Files */}
          <Card>
            <CardHeader
              title="Files"
              description={`${client.attachments.length} shared with this client`}
              action={
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {client.attachments.filter((file) => file.uploadedBy === "CLIENT").length} received
                </span>
              }
            />
            <FileList
              files={client.attachments}
              perspective="staff"
              emptyTitle="No files yet"
              emptyDescription="Upload a deliverable for the client, or wait for them to send one through the portal."
            />
            <div className="border-t border-slate-200 dark:border-slate-800">
              <UploadForm
                action={uploadStaffFileAction}
                clientId={client.id}
                projects={client.projects.map((project) => ({ id: project.id, name: project.name }))}
                accept={ACCEPT_ATTRIBUTE}
                maxBytes={MAX_UPLOAD_BYTES}
                submitLabel="Share with client"
              />
            </div>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader
              title="Open tasks"
              description={`${openTasks.length} outstanding`}
              action={
                <Link
                  href={`/tasks?clientId=${client.id}`}
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  All tasks
                </Link>
              }
            />
            {openTasks.length === 0 ? (
              <EmptyState title="Nothing outstanding" description="No open tasks for this client." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {openTasks.map((task) => (
                  <TaskRow key={task.id} task={task} showClient={false} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <DetailList>
              <DetailRow term="Owner">{client.owner?.name ?? "Unassigned"}</DetailRow>
              <DetailRow term="Email">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                    {client.email}
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow term="Phone">{client.phone ?? "—"}</DetailRow>
              <DetailRow term="Website">
                {client.website ? (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {client.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow term="Industry">{client.industry ?? "—"}</DetailRow>
              <DetailRow term="Address">
                {address ? <span className="whitespace-pre-line">{address}</span> : "—"}
              </DetailRow>
              <DetailRow term="Client since">{formatDate(client.createdAt)}</DetailRow>
            </DetailList>
            {client.notes ? (
              <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Internal notes
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                  {client.notes}
                </p>
              </div>
            ) : null}
            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <ConfirmForm
                action={deleteClientAction}
                hidden={{ clientId: client.id }}
                confirmMessage={`Delete ${client.name}? This also removes their contacts, projects, tasks and invoices. This cannot be undone.`}
              >
                Delete client
              </ConfirmForm>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Portal access"
              description={
                client.portalUsers.length === 0
                  ? "No portal login yet"
                  : `${client.portalUsers.length} login${client.portalUsers.length === 1 ? "" : "s"}`
              }
              action={
                <CreatePortalUser
                  clientId={client.id}
                  defaultName={
                    client.contacts.find((contact) => contact.isPrimary)
                      ? `${client.contacts.find((contact) => contact.isPrimary)!.firstName} ${
                          client.contacts.find((contact) => contact.isPrimary)!.lastName
                        }`
                      : ""
                  }
                  defaultEmail={
                    client.contacts.find((contact) => contact.isPrimary)?.email ??
                    client.email ??
                    ""
                  }
                />
              }
            />
            {client.portalUsers.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                Invite this client to sign in at{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">/login</span> and see
                their projects, invoices and files.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {client.portalUsers.map((portalUser) => (
                  <li key={portalUser.id} className="flex flex-wrap items-start gap-2 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {portalUser.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {portalUser.email}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {portalUser.lastLoginAt
                          ? `Last signed in ${formatDateTime(portalUser.lastLoginAt)}`
                          : "Has not signed in yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <ResetPortalPassword userId={portalUser.id} />
                      <ConfirmForm
                        action={revokePortalUserAction}
                        hidden={{ userId: portalUser.id }}
                        confirmMessage={`Revoke portal access for ${portalUser.email}? They will no longer be able to sign in.`}
                        variant="subtle"
                      >
                        Revoke
                      </ConfirmForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Notes" description={`${client.noteLog.length} entries`} />
            <AddNoteForm clientId={client.id} />
            {client.noteLog.length > 0 ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {client.noteLog.map((note) => (
                  <li key={note.id} className="px-5 py-3">
                    <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {note.body}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {note.author?.name ?? "Unknown"} · {relativeTime(note.createdAt)}
                      </p>
                      <ConfirmForm
                        action={deleteNoteAction}
                        hidden={{ noteId: note.id }}
                        confirmMessage="Delete this note?"
                        variant="subtle"
                      >
                        Delete
                      </ConfirmForm>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            {client.activities.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                {client.activities.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{entry.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {entry.actor?.name ?? "System"} · {relativeTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
