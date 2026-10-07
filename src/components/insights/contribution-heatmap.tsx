"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Day = { dayKey: string; count: number; completed: number };

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const parse = (key: string) => new Date(`${key}T12:00:00`);

/** Quantile thresholds so a busy week doesn't wash everyone else out to level 1. */
function thresholds(days: Day[]) {
  const counts = days
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (!counts.length) return [1, 2, 3, 4];
  const q = (p: number) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))]!;
  return [1, Math.max(2, q(0.4)), Math.max(3, q(0.7)), Math.max(4, q(0.9))];
}

function level(count: number, t: number[]) {
  if (count <= 0) return 0;
  if (count < t[1]!) return 1;
  if (count < t[2]!) return 2;
  if (count < t[3]!) return 3;
  return 4;
}

/**
 * The consistency graph: one square per day, one column per week, like a
 * GitHub contribution calendar. Every card event counts as a contribution.
 */
export function ContributionHeatmap({ days, className }: { days: Day[]; className?: string }) {
  const { weeks, months, t } = useMemo(() => {
    const t = thresholds(days);
    const weeks: (Day | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const week: (Day | null)[] = days.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    const months: { index: number; label: string }[] = [];
    weeks.forEach((week, index) => {
      const first = week[0];
      if (!first) return;
      const label = format(parse(first.dayKey), "MMM");
      if (months.at(-1)?.label !== label) months.push({ index, label });
    });
    // Drop a leading month label that would collide with the next one.
    if (months.length > 1 && months[1]!.index - months[0]!.index < 3) months.shift();
    return { weeks, months, t };
  }, [days]);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-max gap-[3px] pr-6 sm:min-w-0"
          style={{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(11px, 1fr))` }}
        >
          <span />
          {weeks.map((_, i) => (
            <span key={i} className="relative h-4 text-[10px] text-muted-foreground">
              {months.find((m) => m.index === i) && (
                <span className="absolute left-0 whitespace-nowrap">{months.find((m) => m.index === i)!.label}</span>
              )}
            </span>
          ))}
          {Array.from({ length: 7 }).map((_, row) => (
            <Row key={row} row={row} weeks={weeks} t={t} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-[11px] rounded-[3px]" style={{ background: `var(--heat-${l})` }} />
        ))}
        More
      </div>
    </div>
  );
}

function Row({ row, weeks, t }: { row: number; weeks: (Day | null)[][]; t: number[] }) {
  return (
    <>
      <span className="self-center pr-1.5 text-right text-[10px] leading-none text-muted-foreground">
        {WEEKDAY_LABELS[row]}
      </span>
      {weeks.map((week, col) => {
        const day = week[row];
        if (!day) return <span key={col} className="aspect-square w-full max-w-4" />;
        const l = level(day.count, t);
        return (
          <Tooltip key={col}>
            <TooltipTrigger asChild>
              <span
                role="img"
                aria-label={`${day.count} contributions on ${day.dayKey}`}
                className="aspect-square w-full max-w-4 rounded-[3px] outline-offset-1 transition-transform hover:scale-125 hover:outline hover:outline-foreground/40"
                style={{ background: `var(--heat-${l})` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">
                {day.count ? `${day.count} ${day.count === 1 ? "contribution" : "contributions"}` : "No activity"}
              </p>
              <p className="opacity-75">
                {format(parse(day.dayKey), "EEEE, d MMM yyyy")}
                {day.completed ? ` · ${day.completed} finished` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
