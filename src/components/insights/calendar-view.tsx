"use client";

import { IconCheck, IconChevronLeft, IconChevronRight, IconCircleDashed, IconMoonStars } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { AnimatedCalendar } from "@/components/brand/animated-icons";
import { PriorityIcon } from "@/components/common/priority";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC, type RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Day = RouterOutputs["insights"]["calendar"]["days"][number];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parse = (key: string) => new Date(`${key}T12:00:00`);

/** A month of due dates, finished work and day plans. `userId` lets managers view someone else's. */
export function CalendarView({ userId, compact = false }: { userId?: string; compact?: boolean }) {
  const trpc = useTRPC();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selected, setSelected] = useState<string | null>(null);
  const calendar = useQuery(trpc.insights.calendar.queryOptions({ month, userId }));
  const shift = (n: number) => {
    setMonth(format(addMonths(parse(`${month}-01`), n), "yyyy-MM"));
    setSelected(null);
  };

  const today = calendar.data?.today;
  const activeKey = selected ?? (today?.startsWith(month) ? today : null);
  const active = calendar.data?.days.find((d) => d.dayKey === activeKey) ?? null;

  return (
    <div className={cn("grid gap-6", !compact && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
      <Card className="gap-4 overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
            <AnimatedCalendar trigger="mount" />
          </span>
          <div className="mr-auto">
            <CardTitle className="font-heading text-xl">{format(parse(`${month}-01`), "MMMM yyyy")}</CardTitle>
            <CardDescription>
              {calendar.data
                ? `${calendar.data.totals.done} finished · ${calendar.data.totals.due} due this view`
                : "Loading..."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month">
              <IconChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonth(format(new Date(), "yyyy-MM"));
                setSelected(null);
              }}
            >
              Today
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Next month">
              <IconChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:px-4">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-muted/60 py-2 text-center text-xs font-medium text-muted-foreground">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
            {calendar.data
              ? calendar.data.days.map((day) => (
                  <DayCell
                    key={day.dayKey}
                    day={day}
                    inMonth={day.dayKey.startsWith(month)}
                    isToday={day.dayKey === today}
                    selected={day.dayKey === activeKey}
                    onSelect={() => setSelected(day.dayKey)}
                  />
                ))
              : Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-none sm:h-28" />)}
          </div>
          <Legend />
        </CardContent>
      </Card>

      {!compact && <DayPanel day={active} />}
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  selected,
  onSelect,
}: {
  day: Day;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const done = day.items.filter((i) => i.kind === "done").length;
  const due = day.items.filter((i) => i.kind === "due");
  const overdue = due.some((i) => i.overdue);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${format(parse(day.dayKey), "EEEE d MMMM")}: ${done} finished, ${due.length} due`}
      className={cn(
        "group relative flex h-20 flex-col items-stretch gap-1 bg-card p-1.5 text-left transition-colors hover:bg-accent/60 sm:h-28 sm:p-2",
        !inMonth && "bg-muted/40 text-muted-foreground",
        selected && "bg-brand-soft hover:bg-brand-soft ring-2 ring-primary ring-inset",
      )}
    >
      <span className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums",
            isToday && "bg-primary font-bold text-primary-foreground",
          )}
        >
          {Number(day.dayKey.slice(8))}
        </span>
        {day.planned > 0 && <PlanRing done={day.planDone} total={day.planned} closed={day.closed} />}
      </span>
      <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
        {day.items.slice(0, 2).map((item) => (
          <span
            key={`${item.kind}-${item.id}`}
            className={cn(
              "truncate rounded px-1 py-px text-[11px] leading-4",
              item.kind === "done" && "bg-success/15 text-foreground line-through decoration-foreground/30",
              item.kind === "due" && !item.overdue && "bg-primary/25 text-foreground",
              item.overdue && "bg-destructive/10 text-destructive",
            )}
          >
            {item.title}
          </span>
        ))}
        {day.items.length > 2 && (
          <span className="px-1 text-[11px] text-muted-foreground">+{day.items.length - 2} more</span>
        )}
      </span>
      <span className="mt-auto flex gap-0.5 sm:hidden">
        {done > 0 && <span className="size-1.5 rounded-full bg-success" />}
        {due.length > 0 && <span className={cn("size-1.5 rounded-full", overdue ? "bg-destructive" : "bg-primary")} />}
      </span>
    </button>
  );
}

/** Tiny progress ring for the day's plan. */
function PlanRing({ done, total, closed }: { done: number; total: number; closed: boolean }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg viewBox="0 0 18 18" className="size-4.5 -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className={closed ? "stroke-success" : "stroke-chart-1"}
      />
    </svg>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-success/60" /> Finished
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-primary" /> Due
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-destructive/70" /> Overdue
      </span>
      <span className="flex items-center gap-1.5">
        <PlanRing done={2} total={3} closed={false} /> Day plan progress
      </span>
    </div>
  );
}

function DayPanel({ day }: { day: Day | null }) {
  return (
    <Card className="h-fit xl:sticky xl:top-20">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day?.dayKey ?? "none"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex flex-col gap-4"
        >
          <CardHeader>
            <CardTitle className="font-heading">
              {day ? format(parse(day.dayKey), "EEEE, d MMMM") : "Pick a day"}
            </CardTitle>
            <CardDescription>
              {day
                ? day.planned
                  ? `Plan: ${day.planDone} of ${day.planned} done${day.closed ? " · day closed" : ""}`
                  : "Nothing planned"
                : "Select any day to see what was due and what got done."}
            </CardDescription>
          </CardHeader>
          {day && (
            <CardContent className="space-y-4">
              {day.mood && (
                <Badge variant="secondary">
                  <IconMoonStars /> Mood: {day.mood}
                </Badge>
              )}
              {day.items.length ? (
                <ul className="-mx-2 space-y-0.5">
                  {day.items.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={`/boards/${item.boardId}?card=${item.id}`}
                        className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
                      >
                        {item.kind === "done" ? (
                          <IconCheck className="mt-0.5 size-4 shrink-0 text-success" stroke={2.4} />
                        ) : (
                          <IconCircleDashed
                            className={cn("mt-0.5 size-4 shrink-0", item.overdue ? "text-destructive" : "text-brand")}
                            stroke={2}
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate font-medium",
                              item.kind === "done" && "text-muted-foreground",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.key} · {item.board}
                            {item.overdue ? " · overdue" : item.kind === "due" ? " · due" : " · finished"}
                          </span>
                        </span>
                        <PriorityIcon priority={item.priority} className="mt-0.5 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing due or finished on this day.</p>
              )}
            </CardContent>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}
