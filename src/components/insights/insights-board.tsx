"use client";

import { IconArrowRight, IconCalendarEvent } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  AnimatedAlert,
  AnimatedCheckCircle,
  AnimatedClock,
  AnimatedFlame,
  AnimatedListCheck,
  AnimatedTarget,
} from "@/components/brand/animated-icons";
import { PriorityIcon, PRIORITIES } from "@/components/common/priority";
import { ContributionHeatmap } from "@/components/insights/contribution-heatmap";
import { StatTile } from "@/components/insights/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Overview = RouterOutputs["insights"]["overview"];

const dayLabel = (key: string, pattern: string) => format(new Date(`${key}T12:00:00`), pattern);

export function formatCycle(hours: number | null) {
  if (hours == null) return "—";
  return hours < 24 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} d`;
}

const EVENT_VERBS: Record<string, string> = {
  CREATED: "created",
  UPDATED: "updated",
  MOVED: "moved",
  ASSIGNED: "assigned",
  COMMENTED: "commented on",
  COMPLETED: "finished",
  REOPENED: "reopened",
  PLANNED: "planned",
  UNPLANNED: "unplanned",
  ROLLED_OVER: "rolled over",
  ARCHIVED: "archived",
  RESTORED: "restored",
};

/** The full insight layout for one person: yourself, or a report for managers. */
export function InsightsBoard({ userId }: { userId?: string }) {
  const trpc = useTRPC();
  const overview = useQuery(trpc.insights.overview.queryOptions({ userId }));
  if (overview.error) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Couldn&apos;t load insights</EmptyTitle>
          <EmptyDescription>{overview.error.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (!overview.data) return <InsightsSkeleton />;
  const data = overview.data;
  const self = !userId;

  return (
    <div className="space-y-6">
      <KpiRow data={data} self={self} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Consistency</CardTitle>
          <CardDescription>
            {data.kpis.contributions.toLocaleString()} contributions in the last year · active {data.kpis.activeDays30}{" "}
            of the last 30 days · longest streak {data.kpis.longestStreak}{" "}
            {data.kpis.longestStreak === 1 ? "day" : "days"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContributionHeatmap days={data.heatmap} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TrendCard trend={data.trend} />
        <WorkloadCard priorities={data.priorities} status={data.status} open={data.kpis.open} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FocusCard focus={data.focus} />
        <RhythmCard hours={data.hours} weekdays={data.weekdays} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingCard upcoming={data.upcoming} self={self} />
        <RecentCard recent={data.recent} name={self ? "You" : data.person.name.split(" ")[0]!} />
      </div>
    </div>
  );
}

function KpiRow({ data, self }: { data: Overview; self: boolean }) {
  const k = data.kpis;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        tone="brand"
        label="Finished this week"
        value={k.completedThisWeek}
        icon={<AnimatedCheckCircle trigger="inherit" />}
        delta={{ value: k.completedThisWeek - k.completedLastWeek, label: "vs last week" }}
      />
      <StatTile
        label="Open tasks"
        value={k.open}
        icon={<AnimatedListCheck trigger="inherit" />}
        hint={`${k.inProgress} in progress · ${k.dueToday} due today`}
      />
      <StatTile
        tone={k.overdue ? "danger" : "default"}
        label="Overdue"
        value={k.overdue}
        icon={<AnimatedAlert trigger="inherit" />}
        hint={k.stuck ? `${k.stuck} stuck (rolled 3+ times)` : "Nothing stuck"}
      />
      <StatTile
        label="Streak"
        value={
          <span className="inline-flex items-baseline gap-1">
            {k.streak}
            <span className="text-base font-medium text-muted-foreground">{k.streak === 1 ? "day" : "days"}</span>
          </span>
        }
        icon={<AnimatedFlame trigger={k.streak >= 3 ? "loop" : "inherit"} />}
        hint={`Best: ${k.longestStreak} ${k.longestStreak === 1 ? "day" : "days"}`}
      />
      <StatTile
        tone={k.planHitRate != null && k.planHitRate >= 0.7 ? "success" : "default"}
        label="Plan hit rate"
        value={k.planHitRate == null ? "—" : `${Math.round(k.planHitRate * 100)}%`}
        icon={<AnimatedTarget trigger="inherit" />}
        hint={`${k.daysClosed} ${k.daysClosed === 1 ? "day" : "days"} closed out (30d)`}
      />
      <StatTile
        label="Time to finish"
        value={formatCycle(k.avgCycleHours)}
        icon={<AnimatedClock trigger="inherit" />}
        hint={self ? "Average, last 30 days" : "Avg. created → done, 30d"}
      />
    </div>
  );
}

const trendConfig = {
  count: { label: "All activity", color: "var(--chart-2)" },
  completed: { label: "Finished", color: "var(--chart-1)" },
} satisfies ChartConfig;

function TrendCard({ trend }: { trend: Overview["trend"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Last 30 days</CardTitle>
        <CardDescription>Everything touched, and what got finished, day by day.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendConfig} className="h-60 w-full">
          <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fill-completed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-completed)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--color-completed)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.6} />
            <XAxis
              dataKey="dayKey"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(v: string) => dayLabel(v, "d MMM")}
            />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            <ChartTooltip
              cursor={{ strokeDasharray: "4 4" }}
              content={<ChartTooltipContent labelFormatter={(v) => dayLabel(String(v), "EEEE, d MMM")} />}
            />
            <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} fill="none" dot={false} />
            <Area
              dataKey="completed"
              type="monotone"
              stroke="var(--color-completed)"
              strokeWidth={2}
              fill="url(#fill-completed)"
              dot={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const statusConfig = {
  TODO: { label: "To do", color: "var(--chart-2)" },
  IN_PROGRESS: { label: "In progress", color: "var(--chart-1)" },
} satisfies ChartConfig;

function WorkloadCard({
  priorities,
  status,
  open,
}: {
  priorities: Overview["priorities"];
  status: Overview["status"];
  open: number;
}) {
  const max = Math.max(1, ...priorities.map((p) => p.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Workload</CardTitle>
        <CardDescription>Open tasks by stage and priority.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <ChartContainer config={statusConfig} className="aspect-square h-32 shrink-0">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="category" hideLabel />} />
              <Pie
                data={open ? status : [{ category: "TODO", count: 1 }]}
                dataKey="count"
                nameKey="category"
                innerRadius={38}
                outerRadius={58}
                strokeWidth={3}
                stroke="var(--card)"
              >
                {(open ? status : [{ category: "TODO", count: 1 }]).map((s) => (
                  <Cell key={s.category} fill={open ? `var(--color-${s.category})` : "var(--muted)"} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="space-y-2 text-sm">
            <p className="font-heading text-2xl font-bold tabular-nums">{open}</p>
            {status.map((s) => (
              <p key={s.category} className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: statusConfig[s.category].color }} />
                {statusConfig[s.category].label}
                <span className="ml-auto pl-3 font-medium tabular-nums">{s.count}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {priorities.map((p) => {
            const meta = PRIORITIES.find((x) => x.value === p.priority)!;
            return (
              <div key={p.priority} className="flex items-center gap-2 text-sm">
                <span className="flex w-28 items-center gap-1.5 truncate">
                  <meta.icon className={cn("size-4 shrink-0", meta.className)} stroke={2} />
                  {meta.value === "NONE" ? "None" : meta.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700",
                      p.priority === "URGENT" ? "bg-destructive" : "bg-chart-1",
                    )}
                    style={{ width: `${(p.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums">{p.count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const focusConfig = {
  done: { label: "Finished (30d)", color: "var(--chart-1)" },
  open: { label: "Open", color: "var(--chart-2)" },
} satisfies ChartConfig;

function FocusCard({ focus }: { focus: Overview["focus"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Where the time goes</CardTitle>
        <CardDescription>Finished and open work per board.</CardDescription>
      </CardHeader>
      <CardContent>
        {focus.length ? (
          <ChartContainer config={focusConfig} className="w-full" style={{ height: 48 + focus.length * 40 }}>
            <BarChart data={focus} layout="vertical" margin={{ left: 0, right: 12 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} strokeOpacity={0.6} />
              <YAxis dataKey="board" type="category" tickLine={false} axisLine={false} width={110} />
              <XAxis type="number" hide allowDecimals={false} />
              <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent />} />
              <Bar dataKey="done" stackId="a" fill="var(--color-done)" radius={[4, 0, 0, 4]} />
              <Bar dataKey="open" stackId="a" fill="var(--color-open)" radius={[0, 4, 4, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No assigned work yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

const rhythmConfig = { count: { label: "Activity", color: "var(--chart-1)" } } satisfies ChartConfig;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function RhythmCard({ hours, weekdays }: { hours: Overview["hours"]; weekdays: Overview["weekdays"] }) {
  const peak = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0]!);
  const best = weekdays.reduce((a, b) => (b.count > a.count ? b : a), weekdays[0]!);
  const hourLabel = (h: number) => format(new Date(2026, 0, 1, h), "ha").toLowerCase();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Work rhythm</CardTitle>
        <CardDescription>
          {peak.count
            ? `Most active around ${hourLabel(peak.hour)}, busiest on ${WEEKDAYS[best.day]}s (last 30 days).`
            : "Activity by hour of day appears here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer config={rhythmConfig} className="h-36 w-full">
          <BarChart data={hours} margin={{ left: 0, right: 0 }}>
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              interval={5}
              tickFormatter={(h: number) => hourLabel(h)}
            />
            <ChartTooltip
              cursor={{ fillOpacity: 0.4 }}
              content={<ChartTooltipContent labelFormatter={(_, p) => hourLabel(Number(p?.[0]?.payload?.hour ?? 0))} />}
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="grid grid-cols-7 gap-1.5">
          {weekdays.map((d) => {
            const max = Math.max(1, ...weekdays.map((w) => w.count));
            return (
              <div key={d.day} className="text-center">
                <div
                  className="mx-auto h-8 w-full rounded-md"
                  title={`${d.count} on ${WEEKDAYS[d.day]}s`}
                  style={{ background: `var(--heat-${d.count ? Math.max(1, Math.ceil((d.count / max) * 4)) : 0})` }}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">{WEEKDAYS[d.day]}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingCard({ upcoming, self }: { upcoming: Overview["upcoming"]; self: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">{self ? "Your next deadlines" : "Next deadlines"}</CardTitle>
        <CardDescription>Overdue and due in the next 7 days.</CardDescription>
        {self && (
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendar">
                Calendar <IconArrowRight />
              </Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {upcoming.length ? (
          <ul className="-mx-2 divide-y">
            {upcoming.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/boards/${c.board.id}?card=${c.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                >
                  <PriorityIcon priority={c.priority} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.key} · {c.board.name} · {c.column}
                    </p>
                  </div>
                  <Badge variant={c.overdue ? "destructive" : "secondary"} className="shrink-0">
                    <IconCalendarEvent />
                    {c.overdue
                      ? formatDistanceToNowStrict(c.dueDate!, { addSuffix: true })
                      : format(c.dueDate!, "EEE d MMM")}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing due this week. Enjoy the calm.</p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentCard({ recent, name }: { recent: Overview["recent"]; name: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Recent activity</CardTitle>
        <CardDescription>The latest moves on the board.</CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length ? (
          <ol className="relative space-y-3 border-l pl-5">
            {recent.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span
                  className={cn(
                    "absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card",
                    e.type === "COMPLETED" ? "bg-success" : e.type === "ROLLED_OVER" ? "bg-chart-4" : "bg-primary",
                  )}
                />
                <p className="leading-snug">
                  <span className="text-muted-foreground">
                    {name} {EVENT_VERBS[e.type] ?? e.type.toLowerCase()}{" "}
                  </span>
                  <Link href={`/boards/${e.card.boardId}?card=${e.card.id}`} className="font-medium hover:underline">
                    {e.card.title}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.card.key} · {formatDistanceToNowStrict(e.createdAt, { addSuffix: true })}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-52 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
