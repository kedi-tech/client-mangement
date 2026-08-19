import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect, Pagination } from "@/components/filters";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_KEYS,
  ACTIVITY_CATEGORY_TONES,
  activityCategory,
  label,
  roleRank,
  type ActivityCategory,
} from "@/lib/constants";
import { formatDateTime, initials, relativeTime } from "@/lib/format";
import { requireSuperAdmin } from "@/lib/session";
import { getOversightData } from "@/server/queries";

export const metadata: Metadata = { title: "Oversight" };

const PAGE_SIZE = 30;

/** Windows offered in the period filter, in days. "0" means all time. */
const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "0", label: "All time" },
];

const DEFAULT_PERIOD = "30";

type SearchParams = Promise<Record<string, string | undefined>>;

/**
 * Super-admin oversight: what everyone on the team has been doing.
 *
 * A read-only window onto the append-only Activity log that every server action
 * already writes to — nothing here can change data. Restricted to SUPER_ADMIN
 * because it deliberately spans the whole workspace, including the actions of
 * admins, who cannot see this page themselves.
 */
export default async function OversightPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperAdmin();
  const params = await searchParams;

  const period = PERIODS.some((option) => option.value === params.period)
    ? (params.period as string)
    : DEFAULT_PERIOD;
  const days = Number(period);
  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const category = ACTIVITY_CATEGORY_KEYS.includes(params.category as ActivityCategory)
    ? (params.category as ActivityCategory)
    : null;
  const actorId = params.actorId || null;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const data = await getOversightData({ actorId, category, since, page, pageSize: PAGE_SIZE });

  const windowLabel =
    PERIODS.find((option) => option.value === period)?.label.toLowerCase() ?? "this period";

  // Most privileged first, matching /team.
  const roster = [...data.roster].sort(
    (a, b) => roleRank(b.role) - roleRank(a.role) || b.actionCount - a.actionCount,
  );

  return (
    <>
      <PageHeader
        title="Oversight"
        description={`What your admins and their teams have been doing, ${windowLabel}. Read-only — this page changes nothing.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Actions logged</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {data.totals.actions}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Staff active</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {data.totals.activeStaff} of {data.roster.length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Account &amp; access changes</p>
          <p className="mt-1 text-2xl font-semibold text-violet-600 dark:text-violet-400">
            {data.totals.accessChanges}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Roles, password resets, portal access
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Deletions</p>
          <p
            className={
              data.totals.deletions > 0
                ? "mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400"
                : "mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50"
            }
          >
            {data.totals.deletions}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Clients, projects, invoices
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="The team"
          description={`Activity per person, ${windowLabel}. Counts cover everything they did, not the filtered feed below.`}
        />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th className="text-right">Actions</Th>
              <Th>Last action</Th>
              <Th>Last sign-in</Th>
            </tr>
          </thead>
          <tbody>
            {roster.map((member) => (
              <tr key={member.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar text={initials(member.name)} />
                    <div className="min-w-0">
                      <Link
                        href={`/oversight?actorId=${member.id}&period=${period}`}
                        className="truncate font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                      >
                        {member.name}
                      </Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge value={member.role} />
                </Td>
                <Td className="text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {member.actionCount}
                </Td>
                <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {member.lastActionAt ? relativeTime(member.lastActionAt) : "Nothing yet"}
                </Td>
                <Td className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Activity"
          description={`${data.total} ${data.total === 1 ? "entry" : "entries"} matching these filters`}
        />

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <FilterSelect name="period" label="Period" allLabel="Last 30 days" options={PERIODS} />
          <FilterSelect
            name="actorId"
            label="Person"
            allLabel="Everyone"
            options={data.roster.map((member) => ({ value: member.id, label: member.name }))}
          />
          <FilterSelect
            name="category"
            label="Category"
            allLabel="All activity"
            options={ACTIVITY_CATEGORY_KEYS.map((key) => ({
              value: key,
              label: ACTIVITY_CATEGORIES[key].label,
            }))}
          />
        </div>

        {data.entries.length === 0 ? (
          <EmptyState
            title="Nothing logged"
            description="No activity matches these filters. Try a longer period or a different person."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.entries.map((entry) => {
              const bucket = activityCategory(entry.type);
              return (
                <li key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <Avatar text={entry.actor ? initials(entry.actor.name) : "??"} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900 dark:text-slate-100">{entry.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {entry.actor ? entry.actor.name : "A removed account"}
                      {entry.client ? (
                        <>
                          {" · "}
                          <Link
                            href={`/clients/${entry.client.id}`}
                            className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                          >
                            {entry.client.name}
                          </Link>
                        </>
                      ) : null}
                      {" · "}
                      {relativeTime(entry.createdAt)}
                    </p>
                  </div>
                  <span
                    title={label(entry.type)}
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${ACTIVITY_CATEGORY_TONES[bucket]}`}
                  >
                    {ACTIVITY_CATEGORIES[bucket].label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination
          page={page}
          pageCount={data.pageCount}
          total={data.total}
          searchParams={params}
        />
      </Card>
    </>
  );
}
