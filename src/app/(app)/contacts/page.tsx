import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmForm } from "@/components/confirm-form";
import { FilterSelect, Pagination } from "@/components/filters";
import { SearchInput } from "@/components/search-input";
import {
  Avatar,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { initials } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { deleteContactAction } from "@/server/actions/contacts";

export const metadata: Metadata = { title: "Contacts" };

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { title: { contains: q } },
            { client: { name: { contains: q } } },
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
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Every person across your client accounts."
        actions={
          <LinkButton href="/clients" variant="secondary">
            Add via a client
          </LinkButton>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-56 flex-1">
            <SearchInput placeholder="Search name, email, title, client…" />
          </div>
          <FilterSelect
            name="clientId"
            label="Client"
            allLabel="All clients"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
          />
        </div>

        {contacts.length === 0 ? (
          <EmptyState
            title="No contacts found"
            description="Contacts are added from a client's detail page."
            action={<LinkButton href="/clients">Browse clients</LinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Client</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar text={initials(`${contact.firstName} ${contact.lastName}`)} />
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {contact.firstName} {contact.lastName}
                            {contact.isPrimary ? (
                              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                Primary
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {contact.title ?? "—"}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Link
                        href={`/clients/${contact.client.id}`}
                        className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                      >
                        {contact.client.name}
                      </Link>
                    </Td>
                    <Td>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{contact.phone ?? "—"}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
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
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageCount={pageCount} total={total} searchParams={params} />
          </>
        )}
      </Card>
    </>
  );
}
