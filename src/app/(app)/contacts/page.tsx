import type { Metadata } from "next";
import Link from "next/link";

import { RowActions } from "@/components/row-actions";
import { FilterBar, FilterSelect, Pagination } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import {
  Card,
  EmptyBox,
  GridHead,
  GridRow,
  GridTable,
  LinkButton,
  PageHeader,
  Pill,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { like } from "@/lib/search";
import { requireUser } from "@/lib/session";
import { clientScope, viaClient } from "@/server/scope";
import { deleteContactAction } from "@/server/actions/contacts";

export const metadata: Metadata = { title: "Contacts" };

const PAGE_SIZE = 20;
const COLS = "minmax(200px,1.6fr) minmax(150px,1fr) minmax(180px,1.2fr) 130px 130px";

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...viaClient(user),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: like(q) },
            { lastName: like(q) },
            { email: like(q) },
            { title: like(q) },
            { client: { name: like(q) } },
          ],
        }
      : {}),
  };

  const [total, contacts, clients] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.client.findMany({ where: clientScope(user), orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || clientId);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="People at every client, sorted by last name."
        actions={
          <LinkButton href="/clients" variant="secondary">
            Add via a client
          </LinkButton>
        }
      />

      <FilterBar>
        <SearchInput placeholder="Search name, email, title, client" />
        <FilterSelect
          name="clientId"
          label="Client"
          allLabel="All clients"
          options={clients.map((client) => ({ value: client.id, label: client.name }))}
        />
      </FilterBar>

      {contacts.length === 0 ? (
        <EmptyBox
          title={filtered ? "No contacts match those filters" : "No contacts yet"}
          description={
            filtered ? "Try clearing the search or filters." : "Contacts are added from a client's page."
          }
        />
      ) : (
        <>
          <Card>
            <GridTable minWidth={780}>
              <GridHead cols={COLS}>
                <span>Name</span>
                <span>Client</span>
                <span>Email</span>
                <span>Phone</span>
                <span className="text-right">Actions</span>
              </GridHead>
              {contacts.map((contact) => (
                <GridRow key={contact.id} cols={COLS}>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      {contact.firstName} {contact.lastName}
                      {contact.isPrimary ? (
                        <Pill accent className="px-[5px] text-[10.5px] font-medium">
                          Primary
                        </Pill>
                      ) : null}
                    </span>
                    <span className="block text-[11.5px] text-fa">{contact.title ?? ""}</span>
                  </span>
                  <Link href={`/clients/${contact.client.id}`} className="truncate">
                    {contact.client.name}
                  </Link>
                  <span className="truncate text-mu">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-mu hover:text-ac">
                        {contact.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="text-mu">{contact.phone ?? "—"}</span>
                  <RowActions
                    editHref={`/contacts/${contact.id}/edit`}
                    remove={{
                      action: deleteContactAction,
                      hidden: { contactId: contact.id },
                      confirmMessage: `Delete ${contact.firstName} ${contact.lastName}?`,
                    }}
                  />
                </GridRow>
              ))}
            </GridTable>
          </Card>
          <Pagination page={page} pageCount={pageCount} total={total} noun="contact" searchParams={params} />
        </>
      )}
    </>
  );
}
