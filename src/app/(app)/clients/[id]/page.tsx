import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/confirm-form";
import { FileList } from "@/components/file-list";
import { TaskRow } from "@/components/task-row";
import { UploadForm } from "@/components/upload-form";
import {
  Avatar,
  BackLink,
  Badge,
  Card,
  CardHeader,
  DetailList,
  DetailRow,
  Dot,
  EmptyRow,
  LinkButton,
  MicroLabel,
  MoneyCard,
  PageHeader,
  Pill,
} from "@/components/ui";
import { ACTIVITY_CATEGORY_TONES, activityCategory } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { centsToInput, dateToInput, formatDate, formatDateTime, formatMoney, initials, relativeTime } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals, isOutstanding } from "@/lib/invoice";
import { requireUser } from "@/lib/session";
import { clientScope } from "@/server/scope";
import { renewalStatus } from "@/lib/services";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import { deleteClientAction, deleteNoteAction } from "@/server/actions/clients";
import { deleteContactAction } from "@/server/actions/contacts";
import { uploadStaffFileAction } from "@/server/actions/files";
import { AddNoteForm, ContactsHeader } from "./client-panels";
import { PortalAccessPanel } from "./portal-access";
import { ServicesPanel } from "./services-panel";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const client = await prisma.client.findFirst({ where: { id, ...clientScope(user) }, select: { name: true } });
  return { title: client?.name ?? "Client" };
}

export default async function ClientDetailPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id } = await params;

  const client = await prisma.client.findFirst({
    where: { id, ...clientScope(user) },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }] },
      projects: { orderBy: { createdAt: "desc" } },
      invoices: { include: { items: true }, orderBy: { issueDate: "desc" } },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
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
        select: { id: true, name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
      },
      services: { orderBy: [{ kind: "asc" }, { renewsAt: "asc" }] },
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

  const primary = client.contacts.find((contact) => contact.isPrimary);
  const received = client.attachments.filter((file) => file.uploadedBy === "CLIENT").length;

  return (
    <>
      <PageHeader
        title={client.name}
        titleExtra={<Badge value={client.status} />}
        description={[client.company, client.industry].filter(Boolean).join(" · ") || undefined}
        breadcrumb={<BackLink href="/clients">Clients</BackLink>}
        actions={
          <>
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

      <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-3">
        <MoneyCard label="Billed to date" value={formatMoney(billedCents)} />
        <MoneyCard label="Collected" value={formatMoney(paidCents)} valueClassName="text-grn" />
        <MoneyCard
          label="Outstanding"
          value={formatMoney(outstandingCents)}
          valueClassName={outstandingCents > 0 ? "text-red" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <ContactsHeader clientId={client.id} count={client.contacts.length} />
            {client.contacts.length === 0 ? (
              <EmptyRow>No contacts yet.</EmptyRow>
            ) : (
              client.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-l2 px-3.5 py-[9px] last:border-b-0"
                >
                  <Avatar text={initials(`${contact.firstName} ${contact.lastName}`)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      {contact.firstName} {contact.lastName}
                      {contact.isPrimary ? (
                        <Pill accent className="px-[5px] text-[10.5px] font-medium">
                          Primary
                        </Pill>
                      ) : null}
                    </div>
                    <div className="truncate text-[12px] text-fa">
                      {[contact.title, contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px]">
                    <Link href={`/contacts/${contact.id}/edit`}>Edit</Link>
                    <ConfirmForm
                      action={deleteContactAction}
                      hidden={{ contactId: contact.id }}
                      confirmMessage={`Delete ${contact.firstName} ${contact.lastName}?`}
                      variant="subtle"
                    >
                      Delete
                    </ConfirmForm>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card>
            <CardHeader title="Projects" />
            {client.projects.length === 0 ? (
              <EmptyRow>No projects yet.</EmptyRow>
            ) : (
              client.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-2.5 border-b border-l2 px-3.5 py-[9px] text-tx last:border-b-0 hover:bg-hov hover:text-tx"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{project.name}</span>
                    <span className="block text-[12px] text-fa">
                      {formatMoney(project.budgetCents)} budget
                      {project.endDate ? ` · ends ${formatDate(project.endDate)}` : ""}
                    </span>
                  </span>
                  <Badge value={project.status} />
                </Link>
              ))
            )}
          </Card>

          <Card>
            <ServicesPanel
              clientId={client.id}
              services={client.services.map((service) => {
                const renewal = renewalStatus(service.renewsAt);
                return {
                  id: service.id,
                  kind: service.kind,
                  name: service.name,
                  providedBy: service.providedBy,
                  provider: service.provider ?? "",
                  notes: service.notes ?? "",
                  renewsAtInput: dateToInput(service.renewsAt),
                  renewalLabel: renewal.label,
                  renewalState: renewal.state,
                  price: service.priceCents > 0 ? formatMoney(service.priceCents) : "",
                  priceInput: service.priceCents > 0 ? centsToInput(service.priceCents) : "",
                };
              })}
            />
          </Card>

          <Card>
            <CardHeader title="Invoices" />
            {invoices.length === 0 ? (
              <EmptyRow>No invoices yet.</EmptyRow>
            ) : (
              invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-l2 px-3.5 py-[9px] text-tx last:border-b-0 hover:bg-hov hover:text-tx"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px]">{invoice.number}</span>
                    <span className="block text-[12px] text-fa">
                      Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                    </span>
                  </span>
                  <span className="font-mono text-[12.5px]">{formatMoney(invoice.totals.totalCents)}</span>
                  <Badge value={invoice.effectiveStatus} />
                </Link>
              ))
            )}
          </Card>

          <Card>
            <CardHeader
              title="Files"
              description={`${client.attachments.length} shared · ${received} received`}
            />
            <FileList files={client.attachments} emptyText="No files yet." />
            <UploadForm
              action={uploadStaffFileAction}
              clientId={client.id}
              projects={client.projects.map((project) => ({ id: project.id, name: project.name }))}
              accept={ACCEPT_ATTRIBUTE}
              maxBytes={MAX_UPLOAD_BYTES}
              submitLabel="Share with client"
              layout="inline"
            />
          </Card>

          <Card>
            <CardHeader title="Open tasks" action={<Link href={`/tasks?clientId=${client.id}`}>All tasks</Link>} />
            {openTasks.length === 0 ? (
              <EmptyRow>No open tasks.</EmptyRow>
            ) : (
              openTasks.map((task) => <TaskRow key={task.id} task={task} variant="client" />)
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <DetailList>
              <DetailRow term="Email">
                {client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : "—"}
              </DetailRow>
              <DetailRow term="Phone">{client.phone ?? "—"}</DetailRow>
              <DetailRow term="Website">
                {client.website ? (
                  <a href={client.website} target="_blank" rel="noreferrer noopener">
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
            <div className="flex flex-col items-start px-3.5 pb-3">
              {client.notes ? (
                <div className="mt-1 w-full rounded-[4px] bg-hov p-2.5 text-[12.5px] leading-normal">
                  <MicroLabel className="mb-1">Internal notes</MicroLabel>
                  <span className="whitespace-pre-line">{client.notes}</span>
                </div>
              ) : null}
              <ConfirmForm
                action={deleteClientAction}
                hidden={{ clientId: client.id }}
                confirmMessage={`Delete ${client.name}? This also removes their contacts, projects, tasks and invoices. This cannot be undone.`}
                className="mt-3"
              >
                Delete client
              </ConfirmForm>
            </div>
          </Card>

          <Card>
            <PortalAccessPanel
              clientId={client.id}
              defaultName={primary ? `${primary.firstName} ${primary.lastName}` : ""}
              defaultEmail={primary?.email ?? client.email ?? ""}
              logins={client.portalUsers.map((login) => ({
                id: login.id,
                name: login.name,
                email: login.email,
                isMember: login.role !== "CLIENT",
                lastSeen: login.lastLoginAt
                  ? `Last signed in ${formatDateTime(login.lastLoginAt)}`
                  : "Has not signed in yet",
              }))}
            />
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <AddNoteForm clientId={client.id} />
            {client.noteLog.map((note) => (
              <div key={note.id} className="border-b border-l2 px-3.5 py-2.5 last:border-b-0">
                <div className="text-[13px] leading-normal whitespace-pre-line">{note.body}</div>
                <div className="mt-1 flex justify-between text-[11.5px] text-fa">
                  <span>
                    {note.author?.name ?? "Unknown"} · {relativeTime(note.createdAt)}
                  </span>
                  <ConfirmForm
                    action={deleteNoteAction}
                    hidden={{ noteId: note.id }}
                    confirmMessage="Delete this note?"
                    variant="subtle"
                    buttonTextClass="text-[11.5px]"
                  >
                    Delete
                  </ConfirmForm>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            {client.activities.length === 0 ? (
              <div className="p-3.5 text-[12.5px] text-mu">No activity yet.</div>
            ) : (
              client.activities.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[6px_minmax(0,1fr)] gap-2.5 border-b border-l2 px-3.5 py-2 last:border-b-0"
                >
                  <Dot tone={ACTIVITY_CATEGORY_TONES[activityCategory(entry.type)]} />
                  <div>
                    <div className="text-[12.5px] leading-[1.4]">{entry.message}</div>
                    <div className="mt-0.5 text-[11px] text-fa">
                      {entry.actor?.name ?? "System"} · {relativeTime(entry.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
