"use client";

import { IconArrowLeft, IconMail } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { AnimatedShield } from "@/components/brand/animated-icons";
import { UserAvatar } from "@/components/app/user-avatar";
import { PageBody } from "@/components/common/page-header";
import { CalendarView } from "@/components/insights/calendar-view";
import { InsightsBoard } from "@/components/insights/insights-board";
import { PersonalReport } from "@/components/reports/reports-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTRPC } from "@/lib/trpc/client";

type Days = 7 | 14 | 30 | 90;

/** A manager's view of one person: insights, calendar and the period report. */
export function PersonReportView({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const org = useQuery(trpc.org.current.queryOptions());
  const overview = useQuery(trpc.insights.overview.queryOptions({ userId }));
  const [days, setDays] = useState<Days>(30);
  const isManager = org.data && ["OWNER", "ADMIN", "MANAGER"].includes(org.data.role);

  if (org.data && !isManager) {
    return (
      <PageBody>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia className="text-brand">
              <AnimatedShield className="size-12" trigger="loop" />
            </EmptyMedia>
            <EmptyTitle>Managers only</EmptyTitle>
            <EmptyDescription>Ask an admin to make you a manager to see people&apos;s reports.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/reports">Back to reports</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </PageBody>
    );
  }

  const person = overview.data?.person;
  return (
    <PageBody className="max-w-7xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link href="/reports?tab=team">
          <IconArrowLeft /> All people
        </Link>
      </Button>
      <header className="mb-6 flex flex-wrap items-center gap-4">
        {person ? (
          <UserAvatar name={person.name} image={person.image} className="size-16 text-xl" />
        ) : (
          <Skeleton className="size-16 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{person?.name ?? <Skeleton className="h-8 w-56" />}</h1>
          {person && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {person.role && (
                <Badge variant="secondary" className="capitalize">
                  {person.role.toLowerCase()}
                </Badge>
              )}
              {person.title && <span>{person.title}</span>}
              <span className="inline-flex items-center gap-1">
                <IconMail className="size-4" /> {person.email}
              </span>
              {person.joinedAt && <span>· joined {format(person.joinedAt, "d MMM yyyy")}</span>}
            </p>
          )}
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="period">Period report</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <InsightsBoard userId={userId} />
        </TabsContent>
        <TabsContent value="calendar" className="pt-4">
          <CalendarView userId={userId} />
        </TabsContent>
        <TabsContent value="period" className="space-y-4 pt-4">
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
          <PersonalReport days={days} userId={userId} />
        </TabsContent>
      </Tabs>
      <p className="mt-6 text-xs text-muted-foreground">Diaries stay private to each person and never appear here.</p>
    </PageBody>
  );
}
