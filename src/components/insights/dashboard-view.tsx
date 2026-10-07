"use client";

import { IconArrowRight, IconCalendarMonth, IconSunHigh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { AnimatedTrophy, AnimatedUsers } from "@/components/brand/animated-icons";
import { UserAvatar } from "@/components/app/user-avatar";
import { PageBody } from "@/components/common/page-header";
import { InsightsBoard } from "@/components/insights/insights-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { greeting } from "@/lib/dates";
import { useTRPC } from "@/lib/trpc/client";

export function DashboardView() {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.get.queryOptions());
  const org = useQuery(trpc.org.current.queryOptions());
  const isManager = org.data && ["OWNER", "ADMIN", "MANAGER"].includes(org.data.role);

  return (
    <PageBody className="max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d MMMM")}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
            {me.data ? (
              `${greeting(me.data.timezone)}, ${me.data.name.split(" ")[0]}`
            ) : (
              <Skeleton className="h-10 w-72" />
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how your loop is going.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/calendar">
              <IconCalendarMonth /> Calendar
            </Link>
          </Button>
          <Button asChild>
            <Link href="/today">
              <IconSunHigh /> Plan today
            </Link>
          </Button>
        </div>
      </header>

      <InsightsBoard />

      {isManager && <TeamPulse />}
    </PageBody>
  );
}

/** For managers: who's flying and who might need a hand, from the last 14 days. */
function TeamPulse() {
  const trpc = useTRPC();
  const report = useQuery(trpc.report.team.queryOptions({ days: 14 }));
  if (!report.data) return <Skeleton className="mt-6 h-72 rounded-2xl" />;
  const rows = report.data.rows;
  const top = rows.slice(0, 5);
  const attention = rows
    .filter((r) => r.overdue > 0 || r.stale > 0)
    .sort((a, b) => b.overdue + b.stale - (a.overdue + a.stale))
    .slice(0, 5);
  const max = Math.max(1, ...top.map((r) => r.completed));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
              <AnimatedTrophy className="size-5" trigger="mount" />
            </span>
            Top finishers
          </CardTitle>
          <CardDescription>Cards finished across the org, last 14 days.</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports?tab=team">
                All people <IconArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          {top.map((r, i) => (
            <Link
              key={r.person.id}
              href={`/reports/people/${r.person.id}`}
              className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted"
            >
              <span className="w-4 text-center font-heading text-sm font-bold text-muted-foreground">{i + 1}</span>
              <UserAvatar name={r.person.name} image={r.person.image} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.person.name}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-chart-1" style={{ width: `${(r.completed / max) * 100}%` }} />
                </div>
              </div>
              <span className="font-heading text-lg font-bold tabular-nums">{r.completed}</span>
            </Link>
          ))}
          {!top.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">No one has finished anything yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
              <AnimatedUsers className="size-5" trigger="mount" />
            </span>
            Might need a hand
          </CardTitle>
          <CardDescription>People with overdue or stuck cards.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {attention.map((r) => (
            <Link
              key={r.person.id}
              href={`/reports/people/${r.person.id}`}
              className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted"
            >
              <UserAvatar name={r.person.name} image={r.person.image} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.person.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.open} open · last active{" "}
                  {r.lastActiveAt ? formatDistanceToNowStrict(r.lastActiveAt, { addSuffix: true }) : "never"}
                </p>
              </div>
              {r.overdue > 0 && <Badge variant="destructive">{r.overdue} overdue</Badge>}
              {r.stale > 0 && <Badge variant="secondary">{r.stale} stuck</Badge>}
            </Link>
          ))}
          {!attention.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">Everyone&apos;s on track. Nice.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
