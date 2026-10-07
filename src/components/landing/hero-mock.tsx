"use client";

import { IconArrowBackUp, IconCheck, IconMicrophone, IconSparkles } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedFlame } from "@/components/brand/animated-icons";
import { cn } from "@/lib/utils";
import { HEAT_CLASSES, heatLevel } from "./heat";

const tasks = [
  { label: "Review Q4 roadmap with design", done: true, tag: null },
  { label: "Send revised deck to the client", done: true, tag: { icon: IconArrowBackUp, text: "Rolled over" } },
  { label: "Follow up on onboarding call", done: false, tag: { icon: IconMicrophone, text: "From a call" } },
  { label: "Write release notes for v2.3", done: false, tag: null },
];

const WEEKS = 16;
const CELLS = WEEKS * 7;
const EASE = [0.22, 1, 0.36, 1] as const;

/** The hero's product mock: today's plan, a consistency heatmap and a streak tile, all built from divs. */
export function HeroMock() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.5rem] bg-brand-soft/70 blur-2xl sm:-inset-6 dark:bg-brand-soft/40" />

      <motion.div
        className="rounded-3xl border bg-card p-4 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] sm:p-5"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Tuesday</p>
            <p className="font-heading text-lg font-bold tracking-tight">Today&apos;s plan</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            <IconSparkles className="size-3.5" />
            AI captured 2
          </span>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {tasks.map((task, index) => {
            const willCheck = index === 2;
            return (
              <motion.li
                key={task.label}
                className="flex items-center gap-3 rounded-2xl border bg-background/60 px-3 py-2.5"
                initial={reduce ? false : { opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.12, duration: 0.45, ease: EASE }}
              >
                <span className="relative flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border">
                  {(task.done || willCheck) && (
                    <motion.span
                      className="absolute -inset-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
                      initial={reduce ? false : { scale: task.done ? 1 : 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: willCheck ? 1.8 : 0, type: "spring", stiffness: 400, damping: 18 }}
                    >
                      <IconCheck className="size-3" stroke={3} />
                    </motion.span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium",
                      task.done && "text-muted-foreground line-through decoration-muted-foreground/50",
                    )}
                  >
                    {task.label}
                  </span>
                  {task.tag && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <task.tag.icon className="size-3" />
                      {task.tag.text}
                    </span>
                  )}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </motion.div>

      <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-[minmax(0,1fr)_9.5rem]">
        <motion.div
          className="rounded-3xl border bg-card p-4 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.3)]"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Consistency</p>
            <p className="text-[11px] text-muted-foreground">16 weeks</p>
          </div>
          <div
            className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: CELLS }, (_, i) => (
              <motion.span
                key={i}
                className={cn("aspect-square w-full rounded-[3px]", HEAT_CLASSES[heatLevel(i, CELLS)])}
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + Math.floor(i / 7) * 0.04, duration: 0.3 }}
              />
            ))}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col justify-between gap-3 rounded-3xl bg-primary p-4 text-primary-foreground shadow-[0_24px_60px_-30px_rgb(0_0_0/0.4)]"
          initial={reduce ? false : { opacity: 0, y: 24, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: reduce ? 0 : 2 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 220, damping: 18 }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Streak</p>
            <AnimatedFlame trigger="loop" className="size-7" />
          </div>
          <div>
            <p className="font-heading text-4xl leading-none font-bold">12</p>
            <p className="mt-1 text-xs font-medium opacity-75">days closing the loop</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
            <motion.div
              className="h-full rounded-full bg-primary-foreground"
              initial={reduce ? false : { width: "0%" }}
              animate={{ width: "78%" }}
              transition={{ delay: 1.1, duration: 0.9, ease: EASE }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
