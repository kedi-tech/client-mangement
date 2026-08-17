import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { isOutstanding } from "@/lib/invoice";
import { requirePortalUser } from "@/lib/session";
import { getPortalOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Invoices" };

export default async function PortalInvoicesPage() {
  const user = await requirePortalUser();
  const { invoices, totals } = await getPortalOverview(user.clientId);

  return (
    <>
      <PageHeader
        title="Invoices"
        description={
          totals.outstandingCents > 0
            ? `${formatMoney(totals.outstandingCents)} outstanding`
            : "Everything is settled"
        }
      />

      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Issued invoices will appear here as soon as they are sent."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Project</Th>
                  <Th>Status</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <Td>
                      <Link
                        href={`/portal/invoices/${invoice.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {invoice.number}
                      </Link>
                    </Td>
                    <Td>{invoice.project?.name ?? "—"}</Td>
                    <Td>
                      <Badge value={invoice.effectiveStatus} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(invoice.issueDate)}</Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(invoice.dueDate)}</Td>
                    <Td className="text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(invoice.totals.totalCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-xs dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">
                {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                Outstanding:{" "}
                <span className="font-semibold tabular-nums">
                  {formatMoney(
                    invoices
                      .filter((invoice) => isOutstanding(invoice.effectiveStatus))
                      .reduce((sum, invoice) => sum + invoice.totals.totalCents, 0),
                  )}
                </span>
              </span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
