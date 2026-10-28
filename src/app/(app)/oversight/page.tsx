import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect, Pagination } from "@/components/filters";
import {
  Badge,
  Card,
  CardHeader,
  GridHead,
  GridTable,
  PageHeader,
  Pill,
  StatGrid,
  StatTile,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_KEYS,
  ACTIVITY_CATEGORY_TONES,
  activityCategory,
  label,
  oversightMessage,
  roleRank,
  type ActivityCategory,
} from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { requireSuperAdmin } from "@/lib/session";
import { getOversightData } from "@/server/queries";

export const metadata: Metadata = { title: "Oversight" };

const PAGE_SIZE = 30;
const TEAM_COLS = "minmax(180px,1.4fr) 110px 80px 150px 150px";

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

  /** Same URL with some params replaced; resets paging. */
  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") next.set(key, value);
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    return query ? `/oversight?${query}` : "/oversight";
  };

  return (
    <>
      <PageHeader
        title="Oversight"
        description={`What your admins and their teams have been doing, ${windowLabel}. Client details stay private to each owner. Read-only — this page changes nothing.`}
        actions={
          <div className="flex overflow-hidden rounded-[4px] border border-inpb text-[12.5px]">
            {PERIODS.map((option) => {
              const active = option.value === period;
              return (
                <Link
                  key={option.value}
                  href={hrefWith({ period: option.value === DEFAULT_PERIOD ? null : option.value })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "border-r border-inpb px-[11px] py-[5px] last:border-r-0",
                    active ? "bg-ac text-white hover:text-white" : "bg-pn text-tx hover:bg-hov hover:text-tx",
                  )}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        }
      />

      <StatGrid>
        <StatTile label="Actions logged" value={data.totals.actions} />
        <StatTile label="Staff active" value={`${data.totals.activeStaff} of ${data.roster.length}`} />
        <StatTile label="Account & access changes" value={data.totals.accessChanges} />
        <StatTile label="Deletions" value={data.totals.deletions} warn={data.totals.deletions > 0} />
      </StatGrid>

      <Card>
        <CardHeader title="The team" />
        <GridTable minWidth={680}>
          <GridHead cols={TEAM_COLS}>
            <span>Name</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
            <span>Last action</span>
            <span>Last sign-in</span>
          </GridHead>
          {roster.map((member) => (
            <div
              key={member.id}
              className="grid items-center gap-3 border-b border-l2 px-3.5 py-2 text-[13px] last:border-b-0"
              style={{ gridTemplateColumns: TEAM_COLS }}
            >
              <Link href={hrefWith({ actorId: member.id })} className="truncate" title={member.email}>
                {member.name}
              </Link>
              <span>
                <Badge value={member.role} />
              </span>
              <span className="text-right font-mono">{member.actionCount}</span>
              <span className="text-[12.5px] text-mu">
                {member.lastActionAt ? relativeTime(member.lastActionAt) : "Nothing yet"}
              </span>
              <span className="text-[12.5px] text-mu">
                {member.lastLoginAt ? relativeTime(member.lastLoginAt) : "Never"}
              </span>
            </div>
          ))}
        </GridTable>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-l2 px-3.5 py-2 text-[13px]">
          <span>
            <span className="font-semibold">Activity</span>
            <span className="text-fa"> · {data.total} {data.total === 1 ? "entry" : "entries"}</span>
          </span>
          <div className="flex gap-2">
            <FilterSelect
              name="actorId"
              label="Person"
              allLabel="Everyone"
              compact
              options={data.roster.map((member) => ({ value: member.id, label: member.name }))}
            />
            <FilterSelect
              name="category"
              label="Category"
              allLabel="All categories"
              compact
              options={ACTIVITY_CATEGORY_KEYS.map((key) => ({
                value: key,
                label: ACTIVITY_CATEGORIES[key].label,
              }))}
            />
          </div>
        </div>

        {data.entries.length === 0 ? (
          <div className="px-3.5 py-7 text-center text-[13px] text-mu">
            Nothing logged for this filter and period.
          </div>
        ) : (
          data.entries.map((entry) => {
            const bucket = activityCategory(entry.type);
            return (
              <div
                key={entry.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-l2 px-3.5 py-[9px]"
              >
                <div className="min-w-0">
                  <div className="text-[13px]">{oversightMessage(entry)}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[11.5px] text-fa">
                    <span>{entry.actor ? entry.actor.name : "A removed account"}</span>
                    <span>· {relativeTime(entry.createdAt)}</span>
                  </div>
                </div>
                <Pill tone={ACTIVITY_CATEGORY_TONES[bucket]} title={label(entry.type)} className="px-[7px]">
                  {ACTIVITY_CATEGORIES[bucket].label}
                </Pill>
              </div>
            );
          })
        )}

        <Pagination
          page={page}
          pageCount={data.pageCount}
          total={data.total}
          noun="entry"
          nounPlural="entries"
          searchParams={params}
          className="px-3.5 py-[9px]"
        />
      </Card>
    </>
  );
}
