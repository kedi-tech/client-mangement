import type { Metadata } from "next";
import Link from "next/link";

import { SearchInput } from "@/components/search-input";
import { Card } from "@/components/ui";
import { label } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { effectiveInvoiceStatus, invoiceTotals } from "@/lib/invoice";
import { like } from "@/lib/search";
import { requireUser } from "@/lib/session";
import { clientScope, taskScope, viaClient } from "@/server/scope";

export const metadata: Metadata = { title: "Search" };

const LIMIT = 8;

type ResultItem = { key: string; href: string; title: string; sub: string; right?: string };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [clients, contacts, projects, tasks, invoices] = q
    ? await Promise.all([
        prisma.client.findMany({
          where: {
            ...clientScope(user),
            OR: [{ name: like(q) }, { company: like(q) }, { email: like(q) }, { industry: like(q) }],
          },
          take: LIMIT,
        }),
        prisma.contact.findMany({
          where: {
            ...viaClient(user),
            OR: [{ firstName: like(q) }, { lastName: like(q) }, { email: like(q) }, { title: like(q) }],
          },
          take: LIMIT,
          include: { client: { select: { id: true, name: true } } },
        }),
        prisma.project.findMany({
          where: {
            ...viaClient(user),
            OR: [{ name: like(q) }, { description: like(q) }, { client: { name: like(q) } }],
          },
          take: LIMIT,
          include: { client: { select: { id: true, name: true } } },
        }),
        prisma.task.findMany({
          where: {
            AND: [taskScope(user)],
            OR: [{ title: like(q) }, { description: like(q) }, { client: { name: like(q) } }],
          },
          take: LIMIT,
          include: { client: { select: { id: true, name: true } } },
        }),
        prisma.invoice.findMany({
          where: {
            ...viaClient(user),
            OR: [{ number: like(q) }, { notes: like(q) }, { client: { name: like(q) } }],
          },
          take: LIMIT,
          include: { items: true, client: { select: { id: true, name: true } } },
        }),
      ])
    : [[], [], [], [], []];

  const groups: { title: string; items: ResultItem[] }[] = [
    {
      title: "Clients",
      items: clients.map((client) => ({
        key: client.id,
        href: `/clients/${client.id}`,
        title: client.name,
        sub: [client.company, client.industry].filter(Boolean).join(" · "),
      })),
    },
    {
      title: "Contacts",
      items: contacts.map((contact) => ({
        key: contact.id,
        href: `/clients/${contact.client.id}`,
        title: `${contact.firstName} ${contact.lastName}`,
        sub: [contact.title, contact.client.name].filter(Boolean).join(" · "),
      })),
    },
    {
      title: "Projects",
      items: projects.map((project) => ({
        key: project.id,
        href: `/projects/${project.id}`,
        title: project.name,
        sub: project.client.name,
      })),
    },
    {
      title: "Tasks",
      items: tasks.map((task) => ({
        key: task.id,
        href: `/tasks/${task.id}/edit`,
        title: task.title,
        sub: [task.client?.name, label(task.status)].filter(Boolean).join(" · "),
      })),
    },
    {
      title: "Invoices",
      items: invoices.map((invoice) => ({
        key: invoice.id,
        href: `/invoices/${invoice.id}`,
        title: invoice.number,
        sub: `${invoice.client.name} · ${label(effectiveInvoiceStatus(invoice))}`,
        right: formatMoney(invoiceTotals(invoice.items, invoice.taxRate).totalCents),
      })),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      <h1 className="m-0 text-[20px] font-semibold">Search</h1>
      <SearchInput
        placeholder="Search clients, contacts, projects, tasks and invoices"
        autoFocus
        large
        className="w-full max-w-[720px]"
      />

      {!q ? (
        <div className="py-10 text-[13.5px] text-mu">Start typing to search everything.</div>
      ) : groups.length === 0 ? (
        <div className="max-w-[720px] rounded-[6px] border border-dashed border-inpb bg-pn px-4 py-10 text-center text-[13.5px] text-mu">
          Nothing matches &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="flex max-w-[720px] flex-col gap-3">
          {groups.map((group) => (
            <Card key={group.title}>
              <div className="border-b border-l2 px-3.5 py-2 text-[11px] tracking-[.06em] text-mu uppercase">
                {group.title}
              </div>
              {group.items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex justify-between gap-3 border-b border-l2 px-3.5 py-[9px] text-tx last:border-b-0 hover:bg-hov hover:text-tx"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{item.title}</span>
                    <span className="block text-[12px] text-fa">{item.sub}</span>
                  </span>
                  {item.right ? (
                    <span className="self-center font-mono text-[12.5px] text-mu">{item.right}</span>
                  ) : null}
                </Link>
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
