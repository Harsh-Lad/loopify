"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AnimatedFlame } from "@/components/brand/animated-icons";
import { UserAvatar } from "@/components/app/user-avatar";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type Days = 7 | 14 | 30 | 90;

const dayLabel = (v: string, pattern: string) => format(new Date(`${v}T12:00:00`), pattern);

const chartConfig = {
  completed: { label: "Finished", color: "var(--chart-1)" },
  created: { label: "Created", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ReportsView() {
  const trpc = useTRPC();
  const org = useQuery(trpc.org.current.queryOptions());
  const [days, setDays] = useState<Days>(14);
  const params = useSearchParams();
  const router = useRouter();
  const isManager = org.data && ["OWNER", "ADMIN", "MANAGER"].includes(org.data.role);
  const tab = isManager && params.get("tab") === "team" ? "team" : "me";

  return (
    <PageBody>
      <PageHeader
        title="Reports"
        description="Read from everything you and your team actually did, not from status meetings."
        actions={
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(days)}
            onValueChange={(v) => v && setDays(Number(v) as Days)}
          >
            {[7, 14, 30, 90].map((d) => (
              <ToggleGroupItem key={d} value={String(d)}>
                {d} days
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => router.replace(v === "team" ? "/reports?tab=team" : "/reports", { scroll: false })}
        className="mt-6"
      >
        <TabsList>
          <TabsTrigger value="me">My progress</TabsTrigger>
          {isManager && <TabsTrigger value="team">People</TabsTrigger>}
        </TabsList>
        <TabsContent value="me" className="pt-4">
          <PersonalReport days={days} />
        </TabsContent>
        {isManager && (
          <TabsContent value="team" className="pt-4">
            <TeamReport days={days} />
          </TabsContent>
        )}
      </Tabs>
    </PageBody>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-3xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function PersonalReport({ days, userId }: { days: Days; userId?: string }) {
  const trpc = useTRPC();
  const report = useQuery(trpc.report.personal.queryOptions({ days, userId }));
  if (!report.data) return <Skeleton className="h-80 rounded-2xl" />;
  const { totals, series, boards } = report.data;
  const cycle =
    totals.avgCycleHours == null
      ? "None yet"
      : totals.avgCycleHours < 24
        ? `${totals.avgCycleHours.toFixed(1)} h`
        : `${(totals.avgCycleHours / 24).toFixed(1)} days`;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Finished" value={totals.completed} hint={`${totals.created} created`} />
        <Stat
          label="Open now"
          value={totals.open}
          hint={totals.overdue ? `${totals.overdue} overdue` : "Nothing overdue"}
        />
        <Stat label="Typical time to finish" value={cycle} />
        <Card className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="flex items-center gap-1 font-heading text-3xl font-bold tabular-nums">
              {totals.streak}
              {totals.streak >= 3 && <AnimatedFlame className="size-7 text-chart-4" trigger="loop" />}
            </p>
            <p className="text-xs text-muted-foreground">days in a row with something finished</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Day by day</CardTitle>
          <CardDescription>
            {totals.rolled ? `${totals.rolled} roll-overs in this period.` : "No roll-overs in this period."}
            {totals.stale
              ? ` ${totals.stale} open ${totals.stale === 1 ? "card has" : "cards have"} rolled 3 or more times.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={series} margin={{ left: 0, right: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="dayKey"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: string) => dayLabel(v, days > 14 ? "d MMM" : "EEE d")}
              />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(v) => dayLabel(String(v), "EEEE, d MMM")} />}
              />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
              <Bar dataKey="created" fill="var(--color-created)" radius={4} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {boards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Where the work went</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {boards.map((b) => (
              <div key={b.name} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate">{b.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${(b.count / boards[0]!.count) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right tabular-nums">{b.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type TeamData = RouterOutputs["report"]["team"];

function TeamReport({ days }: { days: Days }) {
  const trpc = useTRPC();
  const router = useRouter();
  const teams = useQuery(trpc.team.list.queryOptions());
  const [teamId, setTeamId] = useState<string>("all");
  const report = useQuery(trpc.report.team.queryOptions({ days, teamId: teamId === "all" ? undefined : teamId }));

  return (
    <div className="space-y-4">
      <Select value={teamId} onValueChange={setTeamId}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Whole organization</SelectItem>
          {teams.data?.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {report.data && <TeamCharts data={report.data} days={days} />}

      {!report.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">Finished</TableHead>
                <TableHead className="hidden md:table-cell">Trend</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Stuck</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Days closed</TableHead>
                <TableHead className="hidden lg:table-cell">Last active</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.data.rows.map((row) => (
                <TableRow
                  key={row.person.id}
                  className="group cursor-pointer"
                  onClick={() => router.push(`/reports/people/${row.person.id}`)}
                >
                  <TableCell>
                    <Link
                      href={`/reports/people/${row.person.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <UserAvatar name={row.person.name} image={row.person.image} />
                      {row.person.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{row.completed}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Sparkline values={row.series} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.open}</TableCell>
                  <TableCell className={`text-right tabular-nums ${row.overdue ? "text-destructive" : ""}`}>
                    {row.overdue}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.stale}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{row.daysClosed}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {row.lastActiveAt ? formatDistanceToNowStrict(row.lastActiveAt, { addSuffix: true }) : "Not yet"}
                  </TableCell>
                  <TableCell>
                    <IconChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        &ldquo;Stuck&rdquo; counts open cards that rolled over 3 or more times. Open a person for their full report:
        consistency graph, calendar, workload and trends. Diaries stay private to each person.
      </p>
    </div>
  );
}

const teamConfig = {
  completed: { label: "Finished", color: "var(--chart-1)" },
  created: { label: "Created", color: "var(--chart-2)" },
  rolled: { label: "Rolled over", color: "var(--chart-4)" },
} satisfies ChartConfig;

const loadConfig = {
  open: { label: "Open", color: "var(--chart-2)" },
  overdue: { label: "Overdue", color: "var(--chart-4)" },
} satisfies ChartConfig;

function TeamCharts({ data, days }: { data: TeamData; days: Days }) {
  const load = data.rows
    .map((r) => ({ name: r.person.name.split(" ")[0], open: r.open - r.overdue, overdue: r.overdue }))
    .sort((a, b) => b.open + b.overdue - (a.open + a.overdue))
    .slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Team output</CardTitle>
          <CardDescription>Finished, created and rolled-over cards per day.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={teamConfig} className="h-56 w-full">
            <BarChart data={data.series} margin={{ left: -20, right: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.6} />
              <XAxis
                dataKey="dayKey"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                tickFormatter={(v: string) => dayLabel(v, days > 14 ? "d MMM" : "EEE d")}
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(v) => dayLabel(String(v), "EEEE, d MMM")} />}
              />
              <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" />
              <Bar dataKey="created" stackId="a" fill="var(--color-created)" />
              <Bar dataKey="rolled" stackId="a" fill="var(--color-rolled)" radius={[4, 4, 0, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Workload</CardTitle>
          <CardDescription>Open cards per person, overdue on top.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={loadConfig} className="h-56 w-full">
            <BarChart data={load} margin={{ left: -20, right: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.6} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="open" stackId="a" fill="var(--color-open)" />
              <Bar dataKey="overdue" stackId="a" fill="var(--color-overdue)" radius={[4, 4, 0, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <span className="flex h-6 items-end gap-px" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-sm bg-chart-1"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }}
        />
      ))}
    </span>
  );
}
