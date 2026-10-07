"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import type { ComponentType } from "react";
import { AdminsOnly, DailyAreaChart, isForbidden } from "@/components/admin/admin-shared";
import {
  AnimatedAlert,
  AnimatedBolt,
  AnimatedChartBars,
  AnimatedListCheck,
  AnimatedTrendUp,
  AnimatedUsers,
  type IconTrigger,
} from "@/components/brand/animated-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

const nf = new Intl.NumberFormat();

type IconComp = ComponentType<{ className?: string; trigger?: IconTrigger }>;

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  warn,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: IconComp;
  warn?: boolean;
}) {
  return (
    <motion.div initial="rest" animate="rest" whileHover="active" className="h-full">
      <Card className="h-full gap-1 py-4">
        <CardContent className="flex items-start justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-heading text-3xl font-bold tabular-nums">{nf.format(value)}</p>
            {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          <span
            className={
              warn
                ? "grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"
                : "grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"
            }
          >
            <Icon trigger="inherit" className="size-5" />
          </span>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AdminOverview() {
  const trpc = useTRPC();
  const overview = useQuery(trpc.admin.overview.queryOptions());

  if (overview.error) {
    if (isForbidden(overview.error)) return <AdminsOnly />;
    return <p className="text-sm text-destructive">{errorMessage(overview.error)}</p>;
  }
  if (!overview.data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { totals, series, topOrgs } = overview.data;
  const sum = (key: "signups" | "orgs" | "events") => series.reduce((n, d) => n + d[key], 0);
  const suspended = totals.suspendedUsers + totals.suspendedOrgs;
  const activeShare = totals.users ? Math.round((totals.activeUsers7 / totals.users) * 100) : 0;
  const topMax = Math.max(1, ...topOrgs.map((o) => o.events));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="People"
          value={totals.users}
          hint={`${sum("signups")} joined in 30 days`}
          icon={AnimatedUsers}
        />
        <StatTile
          label="Organizations"
          value={totals.orgs}
          hint={`${sum("orgs")} created in 30 days`}
          icon={AnimatedChartBars}
        />
        <StatTile
          label="Active in 7 days"
          value={totals.activeUsers7}
          hint={`${activeShare}% of everyone`}
          icon={AnimatedTrendUp}
        />
        <StatTile label="Open cards" value={totals.cards} hint="Not archived, all tenants" icon={AnimatedListCheck} />
        <StatTile
          label="Events in 30 days"
          value={totals.events30}
          hint="Card activity, all tenants"
          icon={AnimatedBolt}
        />
        <StatTile
          label="Suspended"
          value={suspended}
          hint={`${totals.suspendedUsers} ${totals.suspendedUsers === 1 ? "person" : "people"}, ${totals.suspendedOrgs} ${totals.suspendedOrgs === 1 ? "org" : "orgs"}`}
          icon={AnimatedAlert}
          warn={suspended > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="font-heading">Sign-ups</CardTitle>
            <CardDescription>New people per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyAreaChart data={series} dataKey="signups" label="Sign-ups" color="var(--chart-1)" />
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="font-heading">New organizations</CardTitle>
            <CardDescription>Created per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyAreaChart data={series} dataKey="orgs" label="New orgs" color="var(--chart-2)" />
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="font-heading">Activity</CardTitle>
            <CardDescription>Card events per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyAreaChart data={series} dataKey="events" label="Events" color="var(--chart-3)" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Most active organizations</CardTitle>
          <CardDescription>By card events in the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {topOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity anywhere in the last 30 days.</p>
          ) : (
            <ol className="space-y-2.5">
              {topOrgs.map((o, i) => (
                <li key={o.id} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-right text-muted-foreground tabular-nums">{i + 1}</span>
                  <Link
                    href={`/admin/orgs?q=${encodeURIComponent(o.name)}`}
                    className="w-32 truncate font-medium hover:underline sm:w-48"
                  >
                    {o.name}
                  </Link>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(o.events / topMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 text-right tabular-nums">{nf.format(o.events)}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
