"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { PageBody } from "@/components/common/page-header";
import { AddToToday } from "@/components/today/add-to-today";
import { DiaryPanel } from "@/components/today/diary-panel";
import { PlanList } from "@/components/today/plan-list";
import { RolloverTray } from "@/components/today/rollover-tray";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";

export function TodayView() {
  const trpc = useTRPC();
  const today = useQuery({ ...trpc.day.today.queryOptions(), refetchInterval: 60_000 });
  const me = useQuery(trpc.me.get.queryOptions());

  if (!today.data || !me.data) return <TodaySkeleton />;
  const { data } = today;
  const firstName = me.data.name.split(" ")[0];
  const done = data.items.filter((i) => i.status === "DONE").length;
  const total = data.items.length;

  return (
    <PageBody className="max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <header className="mb-6">
            <p className="text-sm text-muted-foreground">
              {format(new Date(`${data.dayKey}T12:00:00`), "EEEE, d MMMM")}
            </p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
              {data.greeting}, {firstName}
            </h1>
            <TodayProgress done={done} total={total} />
          </header>

          {data.yesterday && data.yesterday.left.length > 0 && !data.plan.closedAt && (
            <RolloverTray yesterday={data.yesterday} />
          )}

          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Today&apos;s plan</h2>
            <AddToToday plannedCardIds={data.items.map((i) => i.card.id)} />
          </div>
          <PlanList items={data.items} />

          {data.yesterday && data.yesterday.done.length > 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              Last time you finished {data.yesterday.done.length}{" "}
              {data.yesterday.done.length === 1 ? "thing" : "things"}:{" "}
              {data.yesterday.done
                .slice(0, 3)
                .map((c) => c.title)
                .join(", ")}
              {data.yesterday.done.length > 3 ? " and more." : "."}
            </p>
          )}
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DiaryPanel plan={data.plan} done={done} total={total} />
        </aside>
      </div>
    </PageBody>
  );
}

function TodayProgress({ done, total }: { done: number; total: number }) {
  if (!total) return <p className="mt-2 text-muted-foreground">A fresh page. What will you get done today?</p>;
  const pct = Math.round((done / total) * 100);
  const line =
    done === total
      ? "Everything's done. Look at you go."
      : done === 0
        ? `${total} on the plan. Pick one and start.`
        : `${done} of ${total} done. Keep rolling.`;
  return (
    <div className="mt-3 max-w-md">
      <p className="text-muted-foreground">{line}</p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <PageBody className="max-w-7xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-80" />
          <Skeleton className="mt-6 h-32 w-full rounded-2xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </PageBody>
  );
}
