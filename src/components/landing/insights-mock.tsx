"use client";

import { IconArrowUpRight } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { HEAT_CLASSES, heatLevel } from "./heat";

const EASE = [0.22, 1, 0.36, 1] as const;

const week = [
  { day: "Mon", planned: 42, done: 36 },
  { day: "Tue", planned: 48, done: 44 },
  { day: "Wed", planned: 51, done: 40 },
  { day: "Thu", planned: 46, done: 43 },
  { day: "Fri", planned: 38, done: 35 },
];

const people = [
  { initials: "AK", name: "Avery K.", done: 92, seed: 3 },
  { initials: "JM", name: "Jordan M.", done: 81, seed: 41 },
  { initials: "SR", name: "Sam R.", done: 67, seed: 87 },
];

const trend = [30, 38, 34, 46, 44, 55, 52, 63, 61, 72];

/** Calendar days with something due (index 0 = the 1st). */
const busyDays = new Set([2, 3, 8, 9, 10, 14, 16, 17, 22, 23, 24, 28]);

export function InsightsMock() {
  const reduce = useReducedMotion();
  const max = Math.max(...week.map((d) => d.planned));
  const path = trend.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (trend.length - 1)) * 200} ${80 - v}`).join(" ");

  return (
    <div className="relative w-full" aria-hidden>
      <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.5rem] bg-brand-soft/60 blur-2xl dark:bg-brand-soft/30" />
      <motion.div
        className="flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] sm:p-5"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Completion", value: "87%", delta: "+6%" },
            { label: "Rolled over", value: "14", delta: "-3" },
            { label: "Active streaks", value: "9/11", delta: "+2" },
          ].map((kpi) => (
            <div key={kpi.label} className="min-w-0 rounded-2xl bg-muted/60 p-3">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-heading text-xl leading-none font-bold sm:text-2xl">{kpi.value}</p>
              <p className="mt-1 flex items-center gap-0.5 text-[11px] font-semibold text-success">
                <IconArrowUpRight className="size-3" />
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Planned vs done bars */}
          <div className="rounded-2xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Planned vs. done</p>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  Plan
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-chart-1" />
                  Done
                </span>
              </div>
            </div>
            <div className="mt-3 flex h-28 items-end justify-between gap-2">
              {week.map((d, i) => (
                <div key={d.day} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                    <motion.div
                      className="w-1/2 max-w-3 rounded-t-sm bg-muted-foreground/25"
                      initial={reduce ? false : { height: 0 }}
                      whileInView={{ height: `${(d.planned / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.07, duration: 0.6, ease: EASE }}
                    />
                    <motion.div
                      className="w-1/2 max-w-3 rounded-t-sm bg-chart-1"
                      initial={reduce ? false : { height: 0 }}
                      whileInView={{ height: `${(d.done / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: EASE }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trend line */}
          <div className="rounded-2xl border p-3">
            <p className="text-xs font-semibold">Team throughput</p>
            <p className="text-[11px] text-muted-foreground">Last 10 weeks</p>
            <svg viewBox="0 0 200 80" className="mt-2 h-24 w-full overflow-visible" preserveAspectRatio="none">
              <motion.path
                d={`${path} L200 80 L0 80 Z`}
                className="fill-chart-1/15"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.9, duration: 0.5 }}
              />
              <motion.path
                d={path}
                fill="none"
                className="stroke-chart-1"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={reduce ? false : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 1.1, ease: EASE }}
              />
            </svg>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Employee reports */}
          <div className="rounded-2xl border p-3">
            <p className="text-xs font-semibold">Employee reports</p>
            <ul className="mt-2 flex flex-col gap-2.5">
              {people.map((person) => (
                <li key={person.name} className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand">
                    {person.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-medium">{person.name}</span>
                      <span className="text-muted-foreground">{person.done}%</span>
                    </div>
                    <div className="mt-1 flex gap-[2px]">
                      {Array.from({ length: 14 }, (_, d) => (
                        <span
                          key={d}
                          className={cn(
                            "h-2 flex-1 rounded-[2px]",
                            HEAT_CLASSES[heatLevel(person.seed + d, person.seed + 20)],
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Mini calendar */}
          <div className="rounded-2xl border p-3">
            <p className="text-xs font-semibold">October</p>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9px] text-muted-foreground">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
              {Array.from({ length: 3 }, (_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: 31 }, (_, day) => (
                <span
                  key={day}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md",
                    busyDays.has(day) && "bg-brand-soft font-semibold text-foreground",
                    day === 6 && "bg-primary font-bold text-primary-foreground",
                  )}
                >
                  {day + 1}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
